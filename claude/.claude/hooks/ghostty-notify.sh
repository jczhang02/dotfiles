#!/usr/bin/env bash
# Desktop notification through Ghostty (OSC 777) carrying the session title and Claude's last reply.
# Wired to the Stop and Notification hooks; replaces the built-in "Claude is waiting" text.
# Skipped when the pane's window is on screen in a focused Ghostty. Clicking the notification
# raises the Ghostty tab. Ghostty sends it through org.gtk.Notifications under an id of its
# own; the pane option @notify_id keeps the body, and tmux's ghostty-notify.py finds the
# notification by it: notify-focus.sh withdraws it once the pane gets focus, and
# ghostty-notify-click.service selects the pane after a click.
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
# Ghostty keeps only the first 63 bytes of the title and 255 of the body
# (apprt/surface.zig). Cut both first, so the body Ghostty shows is exactly the one
# stored below.
fit() { printf '%s' "$1" | head -c "$2" | iconv -f UTF-8 -t UTF-8 -c 2>/dev/null; }
# A ';' would end the title field of OSC 777.
title=$(fit "${title//;/,}" 63)
# Control characters would break the escape sequence.
# The body identifies the notification, so the pane's place leads it: without it, the same
# permission prompt in two panes would be one notification, withdrawn by either pane.
place=$(tmux display -p -t "$TMUX_PANE" '#{session_name}:#{window_index}#{?#{>:#{window_panes},1},.#{pane_index},}')
body=$(jq -r '(.last_assistant_message // .message // "") | gsub("[[:cntrl:]]+"; " ") | gsub("\\s+"; " ") | if . == "" then "Done" else . end' <<<"$in")
body=$(fit "[$place] $body" 255)

# Replace this pane's previous notification instead of stacking a new one.
notify=~/.config/tmux/ghostty-notify.py
old=$(tmux display -p -t "$TMUX_PANE" '#{@notify_id}')
[ -n "$old" ] && "$notify" withdraw "$old"
tmux set -p -t "$TMUX_PANE" @notify_id "$body"
# tmux passes the sequence of a hidden pane to every client whose session has the pane's
# window, and Ghostty raises the tab of the one that shows it. notify-focus.sh may only
# switch these clients after a click.
window=$(tmux display -p -t "$TMUX_PANE" '#{window_id}')
sessions=$(tmux list-windows -a -F '#{session_id} #{window_id}' | awk -v w="$window" '$2 == w { print $1 }')
clients=$(tmux list-clients -F '#{session_id} #{client_name}' | awk -v s=" $(echo $sessions) " 'index(s, " " $1 " ") { printf " %s", $2 }')
tmux set -p -t "$TMUX_PANE" @notify_clients "$clients "

# With allow-passthrough "on", tmux drops the sequence while the pane is not on screen,
# which is exactly when the notification is wanted; "all" is set for this pane only.
tmux set -p -t "$TMUX_PANE" allow-passthrough all

# Ghostty drops, without queueing, any notification within 1 s of the previous one from the
# whole process (all windows), and identical ones within 5 s. So check that GNOME Shell got
# it and resend if not. Stop once @notify_id is gone: the pane got focus meanwhile and
# notify-focus.sh withdrew the notification. Ghostty 1.4 also withdraws a notification
# itself 3 s after sending it to a focused window, which is after this check.
for _ in 1 2 3; do
  printf '\ePtmux;\e\e]777;notify;%s;%s\a\e\\' "$title" "$body" > "$tty"
  sleep 1.2
  [ "$(tmux display -p -t "$TMUX_PANE" '#{@notify_id}')" = "$body" ] || exit 0
  "$notify" has "$body" && exit 0
done
tmux set -pu -t "$TMUX_PANE" @notify_id \; set -pu -t "$TMUX_PANE" @notify_clients
