#!/bin/sh
# Give each tmux pane its own fcitx5 state, and force English while tmux reads
# keys itself (prefix table, copy mode). fcitx5 only tracks the terminal window,
# so it cannot see pane switches, and in Chinese Rime eats the key after prefix.
# Called from the hooks and prefix bindings in tmux.conf.local.
#
# Pane option @ime: fcitx5-remote state to restore when typing in the pane (2 = 中文).
# Global option @ime_hold: set while the prefix table is active. fcitx5 is forced
# to English then, so its state must not be saved.
# Pane option @ime_mode: set while the pane is in copy mode.

# Remote hosts without fcitx5 have nothing to do.
command -v fcitx5-remote >/dev/null || exit 0

# Set fcitx5 to the saved state of pane $1; English while the pane is in a mode.
restore() {
  if [ "$(tmux display -p -t "$1" '#{?pane_in_mode,1,#{@ime}}')" = 2 ]; then
    fcitx5-remote -o
  else
    fcitx5-remote -c
  fi
}

save() {
  tmux set -p -t "$1" @ime "$(fcitx5-remote)"
}

case "$1" in
  # out PANE CLIENT_FLAGS IN_MODE HOLD (pane-focus-out, synchronous)
  # Skip when the terminal itself lost focus: fcitx5 already reports another window.
  out)
    case "$3" in *focused*) ;; *) exit 0 ;; esac
    [ "$4" = 1 ] || [ "$5" = 1 ] || save "$2"
    ;;
  # in PANE (pane-focus-in)
  in)
    restore "$2"
    ;;
  # prefix PANE IN_MODE HOLD (root binding of a prefix key, synchronous)
  prefix)
    [ "$3" = 1 ] || [ "$4" = 1 ] || save "$2"
    tmux set -g @ime_hold 1
    fcitx5-remote -c
    ;;
  # watch CLIENT (after switch-client -T prefix, background)
  # Wait for the prefix table to end (30 s cap), then restore whatever pane is active now.
  watch)
    i=0
    while [ $i -lt 600 ] &&
      [ "$(tmux display -c "$2" -p '#{client_key_table}' 2>/dev/null)" = prefix ]; do
      sleep 0.05
      i=$((i + 1))
    done
    tmux set -gu @ime_hold
    pane=$(tmux display -c "$2" -p '#{pane_id}' 2>/dev/null) && restore "$pane"
    ;;
  # mode PANE PANE_ACTIVE IN_MODE MODE_FLAG HOLD (pane-mode-changed)
  # Entering copy mode (also by mouse wheel): save, then English. Leaving: restore.
  # With HOLD the prefix binding already saved, and the watcher restores.
  mode)
    [ "$3" = 1 ] || exit 0
    if [ "$4" = 1 ]; then
      [ "$5" = 1 ] && exit 0
      tmux set -p -t "$2" @ime_mode 1
      [ "$6" = 1 ] || save "$2"
      fcitx5-remote -c
    else
      tmux set -pu -t "$2" @ime_mode
      [ "$6" = 1 ] || restore "$2"
    fi
    ;;
esac
