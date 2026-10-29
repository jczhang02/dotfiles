#!/bin/sh
# Set 'background' to $1 (light or dark) in every running Nvim; tmux's
# client-light-theme / client-dark-theme hooks call it when Ghostty switches.
# Nvim reads the terminal background only at startup and cannot see the
# DEC 2031 notification, so tmux tells it through its RPC socket.
for s in "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"/nvim.*.0; do
	[ -S "$s" ] && nvim --server "$s" --remote-expr "execute('set background=$1')" >/dev/null 2>&1 &
done
wait
