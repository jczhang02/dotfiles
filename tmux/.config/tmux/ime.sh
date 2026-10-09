#!/bin/sh
# Give each tmux pane its own fcitx5 state, and force English while tmux reads
# keys itself (prefix table, modes entered by prefix). fcitx5 only tracks the
# terminal window, so it cannot see pane switches, and in Chinese Rime eats the
# key after prefix. Called from the hooks and prefix bindings in tmux.conf.local.
#
# Switch only when tmux reads keys, and only when the state differs: every
# switch flashes the fcitx5 indicator. Mouse copy mode (drag, double click,
# wheel) leaves fcitx5 alone.
#
# Pane option @ime: fcitx5-remote state to restore when typing in the pane (2 = 中文).
# Global option @ime_hold: set while the prefix table is active. fcitx5 is forced
# to English then, so its state must not be saved.
# Pane option @ime_mode: set while the pane is in a mode entered by prefix; English until it ends.

# Remote hosts without fcitx5 have nothing to do.
command -v fcitx5-remote >/dev/null || exit 0

# Set fcitx5 to what pane $1 wants, if it is not already.
restore() {
  want=$(tmux display -p -t "$1" '#{?#{@ime_mode},1,#{@ime}}')
  [ "$want" = 2 ] || want=1
  [ "$(fcitx5-remote)" = "$want" ] && return
  if [ "$want" = 2 ]; then
    fcitx5-remote -o
  else
    fcitx5-remote -c
  fi
}

case "$1" in
  # out PANE CLIENT_FLAGS IME_MODE HOLD (pane-focus-out, synchronous)
  # Skip when the terminal itself lost focus: fcitx5 already reports another window.
  out)
    case "$3" in *focused*) ;; *) exit 0 ;; esac
    [ "$4" = 1 ] || [ "$5" = 1 ] || tmux set -p -t "$2" @ime "$(fcitx5-remote)"
    ;;
  # in PANE (pane-focus-in)
  in)
    restore "$2"
    ;;
  # prefix PANE IME_MODE HOLD (root binding of a prefix key, synchronous)
  # Switch to English before writing options: the next key reaches fcitx5 first.
  prefix)
    state=$(fcitx5-remote)
    [ "$state" = 2 ] && fcitx5-remote -c
    if [ "$3" = 1 ] || [ "$4" = 1 ]; then
      tmux set -g @ime_hold 1
    else
      tmux set -p -t "$2" @ime "$state" \; set -g @ime_hold 1
    fi
    ;;
  # watch CLIENT (after switch-client -T prefix, background)
  # Wait for the prefix table to end (30 s cap). If the prefix key opened a mode
  # (copy mode, choose-tree), keep English until the mode ends; else restore.
  watch)
    i=0
    while [ $i -lt 600 ] &&
      [ "$(tmux display -c "$2" -p '#{client_key_table}' 2>/dev/null)" = prefix ]; do
      sleep 0.05
      i=$((i + 1))
    done
    tmux set -gu @ime_hold
    pane=$(tmux display -c "$2" -p '#{pane_id} #{pane_in_mode}' 2>/dev/null) || exit 0
    case "$pane" in *" 1") tmux set -p -t "${pane% *}" @ime_mode 1 ;; esac
    restore "${pane% *}"
    ;;
  # mode PANE PANE_ACTIVE HOLD (pane-mode-changed, only when a mode entered by prefix ends)
  # With HOLD the watcher restores.
  mode)
    tmux set -pu -t "$2" @ime_mode
    [ "$3" = 1 ] && [ "$4" != 1 ] && restore "$2"
    ;;
esac
exit 0
