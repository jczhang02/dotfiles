#!/bin/sh
# Give each tmux pane its own fcitx5 state. fcitx5 keeps one state per Ghostty
# window and cannot see pane, window or session switches inside tmux. Called
# synchronously from the pane-focus-in hook in tmux.conf.local, so calls never
# overlap.
#
# focus PANE COMMAND IME ENGLISH
#   PANE     pane that gained focus
#   COMMAND  its #{pane_current_command}
#   IME      its @ime: fcitx5-remote state saved when it lost focus (2 = 中文)
#   ENGLISH  @ime_english_commands: commands that always get English (shells)
#
# - Act only when a focused client shows PANE: fcitx5-remote changes whichever
#   window has focus, which may be another program.
# - Coming from another pane of the same client: save the current state to that
#   pane's @ime, then restore PANE's. No @ime means English, so new panes start
#   in English.
# - Same pane as before: the terminal itself regained focus, and fcitx5 has
#   already restored the window's own state. Keep it.
# - COMMAND in ENGLISH: English in both cases, so a shell prompt never starts
#   in Chinese.
# Switch only when the state differs: every switch flashes the fcitx5 indicator.
#
# Global option @ime_last_<client pid>: the pane this client last focused.

# Remote hosts without fcitx5 have nothing to do.
command -v fcitx5-remote >/dev/null || exit 0

# The hook is synchronous: a hung fcitx5 must not freeze tmux for the D-Bus timeout.
fx() { timeout 1 fcitx5-remote "$@"; }

focus() {
  pane=$1 cmd=$2 ime=$3 english=$4
  client=$(tmux list-clients -F '#{client_pid} #{client_flags} #{pane_id}' |
    awk -v p="$pane" '$3 == p && $2 ~ /(^|,)focused(,|$)/ { print $1; exit }')
  [ -n "$client" ] || return 0
  last=$(tmux show -gqv "@ime_last_$client")
  state=$(fx)

  if [ "$last" = "$pane" ]; then
    want=$state
  else
    want=$ime
  fi
  case " $english " in *" $cmd "*) want=1 ;; esac

  if [ "$want" = 2 ]; then
    [ "$state" = 2 ] || fx -o
  else
    [ "$state" = 2 ] && fx -c
  fi

  if [ -z "$last" ]; then
    tmux set -g "@ime_last_$client" "$pane"
  elif [ "$last" != "$pane" ]; then
    # If the last pane was killed, the second set fails; the first still applies.
    tmux set -g "@ime_last_$client" "$pane" \; set -p -t "$last" @ime "$state" 2>/dev/null
  fi
}

case "$1" in
  focus) shift; focus "$@" ;;
esac
exit 0
