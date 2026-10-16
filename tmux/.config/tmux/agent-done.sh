#!/bin/sh
# Mark the caller's tmux window for the status bar (@agent-done), cleared once the
# window is viewed:
#   1     agent finished, not yet seen: accent dot. Claude Code's Stop hook and
#         Codex's notify program.
#   wait  agent waits for an answer: yellow dot. Claude Code's Notification hook
#         (permission_prompt), called as `agent-done.sh wait`.

# Outside tmux (claude -p, a plain terminal) there is nothing to mark.
[ -n "${TMUX_PANE:-}" ] || exit 0

# Codex passes its event as a JSON argument; only a finished turn counts.
# Claude Code passes nothing here (its event arrives on stdin), or "wait".
state=1
case "${1:-}" in
  '' | *agent-turn-complete*) ;;
  wait) state=wait ;;
  *) exit 0 ;;
esac

# Skip the window you are looking at; the pane may also be gone already.
viewed=$(tmux display -p -t "$TMUX_PANE" '#{&&:#{window_active},#{session_attached}}' 2>/dev/null) || exit 0
[ "$viewed" = 1 ] && exit 0

tmux set -w -t "$TMUX_PANE" @agent-done "$state"
