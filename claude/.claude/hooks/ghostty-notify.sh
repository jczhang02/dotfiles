#!/usr/bin/env bash
# Desktop notification through Ghostty (OSC 777) carrying the session title and Claude's last reply.
# Wired to the Stop and Notification hooks; replaces the built-in "Claude is waiting" text.
in=$(cat)
# GHOSTTY_NOTIFY_TTY sends the sequence elsewhere, e.g. a file when testing.
tty=${GHOSTTY_NOTIFY_TTY:-}
if [ -z "$tty" ]; then
  [ -n "$TMUX_PANE" ] || exit 0
  tty=$(tmux display -p -t "$TMUX_PANE" '#{pane_tty}' 2>/dev/null) || exit 0
fi

transcript=$(jq -r .transcript_path <<<"$in")
title=$(grep '"custom-title"' "$transcript" 2>/dev/null | tail -1 | jq -r '.customTitle // empty')
[ -n "$title" ] || title=$(basename "$(jq -r .cwd <<<"$in")")
# A ';' would end the title field of OSC 777.
title=${title//;/,}
# Control characters would break the escape sequence; jq slices by character, so CJK text is not split.
body=$(jq -r '(.last_assistant_message // .message // "") | gsub("[[:cntrl:]]+"; " ") | gsub("\\s+"; " ") | .[0:200]' <<<"$in")

# tmux forwards the wrapped sequence to Ghostty when allow-passthrough is on.
printf '\ePtmux;\e\e]777;notify;%s;%s\a\e\\' "$title" "$body" > "$tty"
