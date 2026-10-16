#!/bin/sh
# Track the agent in the caller's tmux window for the status bar and the agent
# overview (prefix a). Called by Claude Code hooks and Codex's notify program.
#
#   agent-done.sh [EVENT]
#     (none)   turn finished (Claude Code Stop)     → ready,   unseen mark 1
#     JSON     Codex notify; only agent-turn-complete counts, same as (none)
#     wait     permission prompt (Notification)     → blocked, unseen mark wait
#     working  prompt submitted, or a tool finished → working
#              (UserPromptSubmit, PostToolUse: the latter ends "blocked" once
#              you approve)
#     start    session started (SessionStart)       → ready
#     end      session ended (SessionEnd)           → all cleared
#
# Window options:
#   @agent-state  working | blocked | ready
#   @agent-since  epoch seconds of the last state change; the overview shows its age
#   @agent-done   1 | wait: set only while you are not looking at the window;
#                 cleared when you view it (hooks in tmux.conf.local) or when the
#                 agent starts working again; the status bar shows it as a dot

# Outside tmux (claude -p, a plain terminal) there is nothing to mark.
[ -n "${TMUX_PANE:-}" ] || exit 0
t=$TMUX_PANE

case "${1:-}" in
  '' | *agent-turn-complete*) state=ready mark=1 ;;
  wait) state=blocked mark=wait ;;
  working) state=working mark= ;;
  start) state=ready mark= ;;
  end)
    tmux set -wu -t "$t" @agent-state \; set -wu -t "$t" @agent-since \; \
      set -wu -t "$t" @agent-done 2>/dev/null
    exit 0 ;;
  *) exit 0 ;;
esac

# The pane may be gone already.
info=$(tmux display -p -t "$t" '#{@agent-state} #{&&:#{window_active},#{session_attached}}' 2>/dev/null) || exit 0
current=${info% *} viewed=${info##* }

# PostToolUse fires on every tool call: touch tmux only when the state changes,
# so @agent-since keeps the start of the state.
if [ "$current" != "$state" ]; then
  tmux set -w -t "$t" @agent-state "$state" \; set -w -t "$t" @agent-since "$(date +%s)"
  # Working again means the answer arrived (possibly from the phone, without
  # viewing the window), so an old mark no longer applies.
  [ "$state" = working ] && tmux set -wu -t "$t" @agent-done
fi
# Skip the mark for the window you are looking at.
if [ -n "$mark" ] && [ "$viewed" != 1 ]; then
  tmux set -w -t "$t" @agent-done "$mark"
fi
