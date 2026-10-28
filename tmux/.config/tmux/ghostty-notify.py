#!/usr/bin/python3 -I
"""Follow up on the Ghostty notifications that Claude Code's ghostty-notify.sh sends.

That hook keeps each notification's body in the pane option @notify_id. Ghostty 1.4
picks its own notification ids ("ghostty-surface-<surface>-<hash>"), so this script
finds them by body in GNOME Shell's notification store.

  ghostty-notify.py has BODY
      Exit 0 if GNOME Shell holds a Ghostty notification with this body.
  ghostty-notify.py withdraw BODY
      Withdraw every Ghostty notification with this body.
  ghostty-notify.py watch
      Run as a service (ghostty-notify-click.service). When a Ghostty notification is
      clicked, select the tmux pane it came from in the client that got it.

A click must be told apart from Ghostty getting focus: Ghostty 1.4 withdraws a
surface's notifications on focus, so a notification gone from the store says nothing.
A click is the ActivateAction("present-surface") call that GNOME Shell makes on
Ghostty. GNOME Shell saves the store without the clicked notification before it makes
that call, and Ghostty withdraws the rest only after its window gets focus, so the
first store change around the click names the clicked notification.
"""

import os
import subprocess
import sys
import time

from gi.repository import Gio, GLib

APP = "com.mitchellh.ghostty"
# Internal to GNOME Shell: a GVariant file, deleted when no notification is left.
STORE = os.path.join(
    os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"),
    "gnome-shell",
    "notifications",
)
# tmux format separator; unlike a tab, it does not occur in names or bodies.
SEP = "\037"
# A store change this long before or after a click belongs to it.
CLICK_WINDOW = 0.5
# Time for Ghostty to raise and focus the clicked window.
FOCUS_TIMEOUT = 2.0


def notifications():
    """Return (id, body) of each Ghostty notification in the store."""
    try:
        with open(STORE, "rb") as f:
            data = f.read()
    except FileNotFoundError:
        return []
    store = GLib.Variant.new_from_bytes(
        GLib.VariantType.new("a(sa(sv))"), GLib.Bytes.new(data), False
    )
    return [
        (nid, props.get("body", ""))
        for app, notes in store.unpack()
        if app == APP
        for nid, props in notes
    ]


def withdraw(body):
    bus = Gio.bus_get_sync(Gio.BusType.SESSION)
    for nid, b in notifications():
        if b != body:
            continue
        try:
            bus.call_sync(
                "org.gtk.Notifications",
                "/org/gtk/Notifications",
                "org.gtk.Notifications",
                "RemoveNotification",
                GLib.Variant("(ss)", (APP, nid)),
                None,
                Gio.DBusCallFlags.NONE,
                -1,
                None,
            )
        except GLib.Error as e:
            print(f"withdraw {nid}: {e.message}", file=sys.stderr)


def tmux(*args):
    return subprocess.run(
        ["tmux", *args], capture_output=True, text=True
    ).stdout.splitlines()


class Watcher:
    def __init__(self, loop):
        self.loop = loop
        self.bodies = {b for _, b in notifications()}
        # (time, bodies) of the last store change that removed notifications.
        self.removed = (0.0, set())
        self.click = None

        store_dir = Gio.File.new_for_path(os.path.dirname(STORE))
        self.monitor = store_dir.monitor_directory(Gio.FileMonitorFlags.NONE, None)
        self.monitor.connect("changed", lambda *_: self.refresh())

        # Watch the session bus for GNOME Shell's ActivateAction calls on Ghostty.
        self.proc = Gio.Subprocess.new(
            [
                "dbus-monitor",
                "--session",
                "type='method_call',interface='org.freedesktop.Application',"
                f"member='ActivateAction',destination='{APP}'",
            ],
            Gio.SubprocessFlags.STDOUT_PIPE,
        )
        self.out = Gio.DataInputStream.new(self.proc.get_stdout_pipe())
        self.in_call = False
        self.read_line()

    def refresh(self):
        bodies = {b for _, b in notifications()}
        gone = self.bodies - bodies
        self.bodies = bodies
        if gone:
            self.removed = (time.monotonic(), gone)
            if self.click is not None:
                self.resolve()

    def read_line(self):
        self.out.read_line_async(GLib.PRIORITY_DEFAULT, None, self.on_line)

    def on_line(self, stream, result):
        line, _ = stream.read_line_finish_utf8(result)
        if line is None:
            print("dbus-monitor exited", file=sys.stderr)
            self.loop.quit()
            return
        if line.startswith("method call "):
            self.in_call = "member=ActivateAction" in line
        elif self.in_call and line.strip():
            # First argument of the call: the action name.
            if line.strip() == 'string "present-surface"':
                self.on_click()
            self.in_call = False
        self.read_line()

    def on_click(self):
        self.click = time.monotonic()
        # The save may not have reached the file monitor yet.
        self.refresh()
        self.resolve()
        GLib.timeout_add(int(CLICK_WINDOW * 1000), self.give_up, self.click)

    def resolve(self):
        when, gone = self.removed
        if abs(when - self.click) > CLICK_WINDOW:
            return
        self.click = None
        for line in tmux("list-panes", "-a", "-F",
                         SEP.join(["#{pane_id}", "#{@notify_id}", "#{@notify_clients}"])):
            pane, body, clients = (line.split(SEP) + ["", ""])[:3]
            if body and body in gone:
                self.jump(pane, clients.split(), time.monotonic())
                return

    def give_up(self, click):
        if self.click == click:
            self.click = None
        return GLib.SOURCE_REMOVE

    def jump(self, pane, clients, start):
        """Select pane in the client that got the notification, once it has focus."""
        attached = {}
        for line in tmux("list-clients", "-F", SEP.join(["#{client_name}", "#{client_flags}"])):
            name, flags = (line.split(SEP) + [""])[:2]
            attached[name] = flags.split(",")
        target = next((c for c in clients if "focused" in attached.get(c, [])), None)
        if target is None and time.monotonic() - start < FOCUS_TIMEOUT:
            GLib.timeout_add(100, self.jump, pane, clients, start)
            return False
        if target is None:
            target = next((c for c in clients if c in attached), None)
        tmux("set", "-pu", "-t", pane, "@notify_id", ";",
             "set", "-pu", "-t", pane, "@notify_clients")
        if target is not None:
            tmux("switch-client", "-c", target, "-t", pane)
        print(f"clicked: {pane} in client {target}", file=sys.stderr, flush=True)
        return False


def main():
    match sys.argv[1:]:
        case ["has", body]:
            sys.exit(0 if any(b == body for _, b in notifications()) else 1)
        case ["withdraw", body]:
            withdraw(body)
        case ["watch"]:
            loop = GLib.MainLoop()
            watcher = Watcher(loop)
            loop.run()
            watcher.proc.force_exit()
            sys.exit(1)
        case _:
            sys.exit(__doc__)


if __name__ == "__main__":
    main()
