#!/bin/sh
# Withdraw the desktop notification that ghostty-notify.sh (Claude Code hook) sent for a
# pane, once that pane gets focus. Called from tmux hooks as
#   notify-dismiss.sh <pane_id> <notify_id>
# An empty id means there is nothing to withdraw.
[ -n "${2:-}" ] || exit 0
gdbus call --session --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.CloseNotification "$2" >/dev/null 2>&1
tmux set -pu -t "$1" @notify_id 2>/dev/null
exit 0
