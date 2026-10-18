#!/usr/bin/env bash
# Desktop notification carrying the session title and Claude's last reply.
# Wired to the Stop and Notification hooks; replaces the built-in "Claude is waiting" text.
# Skipped when the pane's window is on screen in a focused Ghostty. The notification id is
# kept in the pane option @notify_id, so notify-dismiss.sh can withdraw it once the pane
# gets focus (tmux pane-focus-in hook).
in=$(cat)
[ -n "$TMUX_PANE" ] || exit 0

# Visible = the window is current in an attached session and a client of that session has
# terminal focus (tmux sets "focused" from Ghostty's focus reports; needs focus-events on).
# GHOSTTY_NOTIFY_FORCE=1 skips this check, e.g. when testing.
if [ -z "${GHOSTTY_NOTIFY_FORCE:-}" ]; then
  read -r viewed session < <(tmux display -p -t "$TMUX_PANE" '#{&&:#{window_active},#{session_attached}} #{session_id}' 2>/dev/null) || exit 0
  [ "$viewed" = 1 ] && tmux list-clients -t "$session" -F '#{client_flags}' | grep -qw focused && exit 0
fi

transcript=$(jq -r .transcript_path <<<"$in")
title=$(grep '"custom-title"' "$transcript" 2>/dev/null | tail -1 | jq -r '.customTitle // empty')
[ -n "$title" ] || title=$(basename "$(jq -r .cwd <<<"$in")")
# jq slices by character, so CJK text is not split.
body=$(jq -r '(.last_assistant_message // .message // "") | gsub("[[:cntrl:]]+"; " ") | gsub("\\s+"; " ") | .[0:200]' <<<"$in")

# libnotify instead of OSC 777: a Ghostty notification has no id, so it cannot be withdrawn.
# No desktop-entry hint: GNOME Shell then ties the notification to the sender's D-Bus name
# and removes it as soon as notify-send exits.
# --replace-id makes a new turn in the same pane update its old notification.
old=$(tmux display -p -t "$TMUX_PANE" '#{@notify_id}')
id=$(notify-send --print-id --app-name=Ghostty --icon=com.mitchellh.ghostty \
  ${old:+--replace-id="$old"} -- "$title" "$body") || exit 0
tmux set -p -t "$TMUX_PANE" @notify_id "$id"
