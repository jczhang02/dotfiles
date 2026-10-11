#!/usr/bin/env bash
# PreToolUse guard for Bash: refuse git commands that skip git hooks
# (--no-verify, `git commit -n`, or a core.hooksPath override), so the global
# Conventional Commits check in ~/.config/git/hooks always runs for agents.
cmd=$(jq -r '.tool_input.command // empty')
grep -q 'git' <<<"$cmd" || exit 0
# Quoted text (a commit message) may mention the flags; look only outside it.
cmd=$(sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g" <<<"$cmd")

reason=''
if grep -Eq -- '--no-verify\b' <<<"$cmd"; then
  reason='--no-verify skips git hooks'
elif grep -Eqi 'core\.hookspath' <<<"$cmd"; then
  reason='overriding core.hooksPath skips the global git hooks'
elif grep -Eq '\bgit\b[^|;&]*\bcommit\b[^|;&]*[[:space:]]-[[:alpha:]]*n[[:alpha:]]*([[:space:]]|$)' <<<"$cmd"; then
  reason='git commit -n skips git hooks'
fi
[ -n "$reason" ] || exit 0

jq -n --arg r "Blocked: $reason. Commit messages must pass the Conventional Commits check: type(scope): subject, type one of build bump chore ci docs feat fix perf refactor revert style test, first line at most 72 characters. Fix the message and commit again; if JC wants a bypass, they run the command themselves." \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
