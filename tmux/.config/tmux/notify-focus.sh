#!/bin/sh
# Withdraw the Ghostty notification of a pane you look at (pane-focus-in). Claude Code's
# ghostty-notify.sh keeps the notification's body in the pane option @notify_id;
# ghostty-notify.py finds Ghostty's notification ids by that body. Clicks are handled by
# ghostty-notify.py watch (ghostty-notify-click.service).
#
#   notify-focus.sh dismiss <pane_id>

case "${1:-}" in
  dismiss)
    # Read here, not passed from the hook: tmux would paste the body into sh -c unquoted.
    id=$(tmux show -pv -t "$2" @notify_id 2>/dev/null)
    [ -n "$id" ] || exit 0
    "$(dirname "$0")/ghostty-notify.py" withdraw "$id"
    tmux set -pu -t "$2" @notify_id \; set -pu -t "$2" @notify_clients
    ;;
esac
exit 0
