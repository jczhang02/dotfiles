#!/bin/sh
# Mark the caller's tmux window as "agent finished, not yet seen" (@agent-done),
# which tmux.conf.local shows as a pink "!" on the window tab and clears once the
# window is viewed. Called by Claude Code's Stop hook and Codex's notify program.

# Outside tmux (claude -p, a plain terminal) there is nothing to mark.
[ -n "${TMUX_PANE:-}" ] || exit 0

# Codex passes its event as a JSON argument; only a finished turn counts.
# Claude Code passes nothing here (its event arrives on stdin).
case "${1:-}" in
  '' | *agent-turn-complete*) ;;
  *) exit 0 ;;
esac

# Skip the window you are looking at; the pane may also be gone already.
viewed=$(tmux display -p -t "$TMUX_PANE" '#{&&:#{window_active},#{session_attached}}' 2>/dev/null) || exit 0
[ "$viewed" = 1 ] && exit 0

tmux set -w -t "$TMUX_PANE" @agent-done 1
