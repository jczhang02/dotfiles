#!/usr/bin/env bash
# Desktop notification through Ghostty (OSC 777) carrying the session title and Claude's last reply.
# Wired to the Stop and Notification hooks; replaces the built-in "Claude is waiting" text.
# Skipped when the pane's window is on screen in a focused Ghostty. Clicking the notification
# raises the Ghostty tab. Ghostty sends it through org.gtk.Notifications with the body as id;
# the pane option @notify_id keeps that id, so tmux's notify-focus.sh can withdraw the
# notification once the pane gets focus, or select the pane after a click.
in=$(cat)
[ -n "$TMUX_PANE" ] || exit 0

# Visible = the window is current in an attached session and a client of that session has
# terminal focus (tmux sets "focused" from Ghostty's focus reports; needs focus-events on).
# GHOSTTY_NOTIFY_FORCE=1 skips this check, e.g. when testing.
if [ -z "${GHOSTTY_NOTIFY_FORCE:-}" ]; then
  read -r viewed session < <(tmux display -p -t "$TMUX_PANE" '#{&&:#{window_active},#{session_attached}} #{session_id}' 2>/dev/null) || exit 0
  [ "$viewed" = 1 ] && tmux list-clients -t "$session" -F '#{client_flags}' | grep -qw focused && exit 0
fi
tty=$(tmux display -p -t "$TMUX_PANE" '#{pane_tty}' 2>/dev/null) || exit 0

transcript=$(jq -r .transcript_path <<<"$in")
title=$(grep '"custom-title"' "$transcript" 2>/dev/null | tail -1 | jq -r '.customTitle // empty')
[ -n "$title" ] || title=$(basename "$(jq -r .cwd <<<"$in")")
# Ghostty keeps only the first 63 bytes of the title and 255 of the body, cut mid-character
# if need be (termio/stream_handler.zig). Cut both on a character boundary first, so the
# body Ghostty uses as notification id is exactly the one stored below.
fit() { printf '%s' "$1" | head -c "$2" | iconv -f UTF-8 -t UTF-8 -c 2>/dev/null; }
# A ';' would end the title field of OSC 777.
title=$(fit "${title//;/,}" 63)
# Control characters would break the escape sequence.
# The body doubles as the notification id, so it must not be empty.
body=$(jq -r '(.last_assistant_message // .message // "") | gsub("[[:cntrl:]]+"; " ") | gsub("\\s+"; " ") | if . == "" then "Done" else . end' <<<"$in")
body=$(fit "$body" 255)

# Replace this pane's previous notification instead of stacking a new one.
old=$(tmux display -p -t "$TMUX_PANE" '#{@notify_id}')
[ -n "$old" ] && gdbus call --session --dest org.gtk.Notifications --object-path /org/gtk/Notifications \
  --method org.gtk.Notifications.RemoveNotification com.mitchellh.ghostty "$old" >/dev/null 2>&1
tmux set -p -t "$TMUX_PANE" @notify_id "$body"

# With allow-passthrough "on", tmux drops the sequence while the pane is not on screen,
# which is exactly when the notification is wanted; "all" is set for this pane only.
tmux set -p -t "$TMUX_PANE" allow-passthrough all

# Ghostty drops, without queueing, any notification within 1 s of the previous one from the
# whole process (all windows), and identical ones within 5 s. So check that GNOME Shell got
# it and resend if not. A dropped one must not keep @notify_id: notify-focus.sh would take
# the missing notification for a click and jump to this pane. Stop once the id is gone:
# the pane got focus meanwhile and notify-focus.sh withdrew the notification.
store=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/notifications
for _ in 1 2 3; do
  printf '\ePtmux;\e\e]777;notify;%s;%s\a\e\\' "$title" "$body" > "$tty"
  sleep 1.2
  [ "$(tmux display -p -t "$TMUX_PANE" '#{@notify_id}')" = "$body" ] || exit 0
  grep -qaF -- "$body" "$store" 2>/dev/null && exit 0
done
tmux set -pu -t "$TMUX_PANE" @notify_id
