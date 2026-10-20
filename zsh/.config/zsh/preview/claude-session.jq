# claude -r <Tab> 的会话预览, 由 03-option.zsh 的 fzf-preview 调用:
#   jq -nr --arg meta "<时间 · 大小 · id>" -f claude-session.jq <id>.jsonl
# 输出: 标题 (与 /resume 同优先级), 元信息, 开头 3 条和最后 3 条用户输入.
# 只列用户输入: 找会话靠的是当初问了什么, assistant 回复反而淹没线索.
# fork 出的会话复制了父会话的开头, 只有结尾能区分, 所以首尾都列.
def text:
  .message.content
  | if type == "string" then . else (map(select(.type == "text").text) | join(" ")) end
  | gsub("\\s+"; " ") | ltrimstr(" ");
def clip($n): if length > $n then .[0:$n] + "…" else . end;

reduce inputs as $e ({prompts: [], custom: null, ai: null, branch: null};
  if $e.type == "custom-title" then .custom = $e.customTitle
  elif $e.type == "ai-title" then .ai = $e.aiTitle
  elif $e.type == "user" and ($e.isMeta | not) and ($e.isSidechain | not)
       and ($e.isCompactSummary | not) then
    .branch = ($e.gitBranch // .branch)
    | ($e | text) as $t
    # 跳过斜杠命令, 中断提示, 以及连续重复的输入 (重发同一条消息).
    | if $t == "" or ($t | test("^(<|\\[Request interrupted)")) or $t == .prompts[-1]
      then . else .prompts += [$t] end
  else . end)
| .prompts as $p
| ($p | length) as $n
| (.custom // .ai // $p[0] // "(无标题)" | clip(120)) as $title
| ("\u001b[1m" + $title + "\u001b[0m"),
  ("\u001b[2m" + ([.branch // empty, $meta, "\($n) 条输入"] | join(" · ")) + "\u001b[0m"),
  "",
  ( (if $n <= 6 then $p else $p[0:3] + ["⋯ 省略 \($n - 6) 条"] + $p[-3:] end)[]
    | if startswith("⋯") then "\u001b[2m  " + . + "\u001b[0m"
      else "\u001b[1;35m❯\u001b[0m " + clip(240) end )
