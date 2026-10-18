#!/bin/sh
# Follow up on the Ghostty notifications that Claude Code's ghostty-notify.sh sends. That
# script keeps each notification's id (its body) in the pane option @notify_id.
#
#   notify-focus.sh dismiss <pane_id> <notify_id>
#       pane-focus-in: you are looking at the pane, so withdraw its notification.
#   notify-focus.sh jump <client_name>
#       client-focus-in: Ghostty regained focus. A pane whose notification is gone from
#       GNOME Shell, but not withdrawn here, had it clicked (or closed); select that pane.
#       Only in a client that received the notification (@notify_clients): a click also
#       hands focus back to the Ghostty window you were in, and that one must stay put.

# Ghostty sends through org.gtk.Notifications, which accepts removals from any caller.
withdraw() {
  gdbus call --session --dest org.gtk.Notifications --object-path /org/gtk/Notifications \
    --method org.gtk.Notifications.RemoveNotification com.mitchellh.ghostty "$1" >/dev/null 2>&1
}

case "${1:-}" in
  dismiss)
    [ -n "${3:-}" ] || exit 0
    withdraw "$3"
    tmux set -pu -t "$2" @notify_id \; set -pu -t "$2" @notify_clients
    ;;
  jump)
    # GNOME Shell stores the open org.gtk.Notifications here (a GVariant file, deleted when
    # empty). It is internal to GNOME Shell; if it moves, clicks only raise the Ghostty tab.
    store=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/notifications
    # \037 as separator: unlike a tab, read does not merge it when a field is empty.
    us=$(printf '\037')
    tmux list-panes -a -F "#{pane_id}$us#{@notify_id}$us#{@notify_clients}" |
    while IFS=$us read -r pane id clients; do
      [ -n "$id" ] || continue
      case "$clients" in *" $2 "*) ;; *) continue ;; esac
      [ -f "$store" ] && grep -qaF -- "$id" "$store" && continue
      tmux set -pu -t "$pane" @notify_id \; set -pu -t "$pane" @notify_clients
      tmux switch-client -c "$2" -t "$pane"
    done
    ;;
esac
exit 0
