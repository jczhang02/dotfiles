# ==== Option ====

# completion

SPROMPT="%B%F{yellow}zsh: correct '%R' be '%r' [nyae]?%f%b "

# 禁用旧补全系统
zstyle ':completion:*' use-compctl false

# 补全顺序:
# _complete - 普通补全函数  _extensions - 通过 *.\t 选择扩展名
# _match    - 和 _complete 类似但允许使用通配符
# _expand_alias - 展开别名 _ignored - 被 ignored-patterns 忽略掉的
# zstyle ':completion:*' completer _expand_alias _complete _extensions _match _files
# 由于某些 completer 调用的代价比较昂贵，第一次调用时不考虑它们
zstyle -e ':completion:*' completer '
  if [[ $_last_try != "$HISTNO$BUFFER$CURSOR" ]]; then
    _last_try="$HISTNO$BUFFER$CURSOR"
    reply=(_expand_alias _complete _extensions _match _files)
  else
    reply=(_complete _ignored _correct _approximate)
fi'

# 增强版文件名补全
# 0 - 完全匹配 ( Abc -> Abc )      1 - 大写修正 ( abc -> Abc )
# 2 - 单词补全 ( f-b -> foo-bar )  3 - 后缀补全 ( .cxx -> foo.cxx )
zstyle ':completion:*:(argument-rest|files):*' matcher-list '' \
    'm:{[:lower:]-}={[:upper:]_}' \
    'r:|[.,_-]=* r:|=*' \
    'r:|.=* r:|=*'
# zstyle ':completion:*' matcher-list 'b:=*'

# 不展开普通别名
zstyle ':completion:*' regular false

# 结果样式
zstyle ':completion:*' menu no # search
zstyle ':completion:*' list-grouped false
zstyle ':completion:*' list-separator ''
zstyle ':completion:*' group-name ''
zstyle ':completion:*' verbose yes
zstyle ':completion:*:matches' group 'yes'
zstyle ':completion:*:warnings' format '%F{red}%B-- No match for: %d --%b%f'
zstyle ':completion:*:messages' format '%d'
zstyle ':completion:*:corrections' format '%B%d (errors: %e)%b'
zstyle ':completion:*:descriptions' format '[%d]'

# 补全当前用户所有进程列表
zstyle ':completion:*:*:*:*:processes' command "ps -u $USER -o pid,user,comm,cmd -w -w"
zstyle ':completion:*:kill:*' ignored-patterns '0'

# complete manual by their section, from grml
zstyle ':completion:*:manuals'    separate-sections true
zstyle ':completion:*:manuals.*'  insert-sections   true

# disable conda directory
zstyle ':completion:*:conda:*' tag-order  '! (|*-)directories' -
zstyle ':completion:*:mamba:*' tag-order  '! (|*-)directories' -

zstyle ':completion:*:conda:*' ignored-patterns 'base|rsyslog'
zstyle ':completion:*:mamba:*' ignored-patterns 'base|rsyslog'

# 允许 docker 补全时识别 -it 之类的组合命令
zstyle ':completion:*:*:docker:*' option-stacking yes
zstyle ':completion:*:*:docker-*:*' option-stacking yes

# color
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}

# fg/bg 补全时使用 jobs id
zstyle ':completion:*:jobs' verbose true
zstyle ':completion:*:jobs' numbers true

# 单词中也进行补全
setopt complete_in_word
setopt no_beep

## common options
setopt auto_cd
setopt multios
setopt auto_pushd
setopt pushd_ignore_dups
setopt listpacked
setopt interactive_comments
setopt transient_rprompt
setopt ksh_option_print
setopt rc_quotes

## glob
setopt extended_glob
setopt no_nomatch

## spell check
unsetopt correct

## auto slash
zstyle ':completion:*' special-dirs true
setopt autoparamslash

## select word style: smart quick delete and move
autoload -U select-word-style
select-word-style bash

## FUNCNEST
FUNCNEST=1000

## zsh-autosuggestions
ZSH_AUTOSUGGEST_STRATEGY+=(match_prev_cmd completion)
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_COMPLETION_IGNORE='( |man |pikaur -S )*'
ZSH_AUTOSUGGEST_HISTORY_IGNORE='?(#c50,)'
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='bold,underline'

## zce
zstyle ':zce:*' keys 'asdghklqwertyuiopzxcvbnmfj;23456789'

## fzf-tab
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview 'ps --pid="$word" -o cmd --no-headers -w -w'
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-flags '--preview-window=down:3:wrap'
# 预览用普通文字色 + 尾部 /, 比左侧彩色列表安静, 视线先落在候选项上.
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --classify=always --color=never --ignore-glob="*.bbl|*.aux|*.blg|*.fdb_latexmk|*.fls|*.log|*.synctex.gz|indent.log|*.pyg" "$realpath"'

# fzf-tab 在提示符下方行内显示 fzf, 不用 tmux popup 浮窗: 浮窗在 grouped session
# 下会浮到其他 client (2026-05-19), 且 tmux 内外表现不一致.
# 行内高度 = 候选项数 + fzf-pad, 至少 fzf-min-height, 至多终端的 2/3.
# 下面的样式把输入行压成一行 (计数在右端, 无横线), 所以 fzf-pad 1 正好不留空行.
zstyle ':fzf-tab:*' fzf-pad 1
zstyle ':fzf-tab:*' fzf-min-height 8

# 末尾追加的样式参数对所有 fzf-tab 补全生效: fzf-tab-source 给几乎每个 context
# 都设了 fzf-flags, 全局 ':fzf-tab:*' fzf-flags 会被遮蔽. fzf 合并多个
# --preview-window, 所以各 context 的位置和大小不变, 只把预览框换成一条分隔线;
# 计数移到输入行右端并去掉其下横线, 省掉一行.
function ftb-fzf() {
    command fzf "$@" --info=inline-right --no-separator --preview-window=border-line
}
zstyle ':fzf-tab:*' fzf-command ftb-fzf
zstyle ':fzf-tab:*' switch-group ',' '.'

zstyle ":completion:*:git-checkout:*" sort false
zstyle ':completion:*' file-sort modification
# fzf-tab 查询 sort 的 context 是 ":completion:complete:<cmd>:..." (completion 后只有
# 一个冒号), 因此 ':completion:*:*:eza:*' 在 fzf-tab 下永不命中; 只能写单个 '*'.
zstyle ':completion:*:eza:*' sort false
zstyle ':fzf-tab:*:*argument-rest*' fzf-pad 9
zstyle ':fzf-tab:*:*argument-rest*' fzf-preview
# fzf-tab 默认忽略 FZF_DEFAULT_OPTS, 显式启用以沿用 01-env.zsh 的 Catppuccin 配色.
zstyle ':fzf-tab:*' use-fzf-default-opts yes
# 选项列表无内容可预览; 去掉空 preview 窗, 让描述占满宽度.
# fzf-tab-source 的 '<cmd> --help' 选项预览 pattern 更具体, 不受影响.
zstyle ':fzf-tab:complete:*:options' fzf-preview

# git-* 预览由 fzf-tab-source 的 sources/git-*.zsh 提供; 其 pattern 比 git-xxx:*
# 更具体, 本地同类 zstyle 不会生效, 故不再重复定义. 依赖 04-plugin.zsh 换回原生 _git.

## Claude Code
# 保持 _claude 按最近使用排序的会话列表, 不被 fzf-tab 按字母重排.
zstyle ':completion:*:claude:*' sort false
# claude -r/--resume <Tab>: 预览会话标题, 时间, 开头和结尾的用户输入 (见 preview/claude-session.jq).
# 会话文件位于 ~/.claude/projects/<mangled-cwd>/<id>.jsonl.
zstyle ':fzf-tab:complete:claude:option-(-resume|r)-1' fzf-preview '
  local -a f=( ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/$word.jsonl(N) )
  [[ -r $f[1] ]] || return
  local meta="$(date -r $f[1] "+%m-%d %H:%M") · $(numfmt --to=iec --suffix=B $(stat -c %s $f[1])) · ${word:0:8}"
  jq -nr --arg meta $meta -f ${ZDOTDIR:-$HOME/.config/zsh}/preview/claude-session.jq $f[1] 2>/dev/null'
zstyle ':fzf-tab:complete:claude:option-(-resume|r)-1' fzf-flags '--preview-window=right:40%:wrap'
# 会话常只有几个, 默认高度只够预览几行; 加高到放得下标题, 元信息和首尾输入.
zstyle ':fzf-tab:complete:claude:option-(-resume|r)-1' fzf-min-height 20
# 默认的 prefix 查询会把标题的共同开头 (如 "docs: ") 填进 fzf 输入框; 只用已输入的内容.
zstyle ':fzf-tab:complete:claude:option-(-resume|r)-1' query-string input

## history
command mkdir -p -m 700 -- "$XDG_STATE_HOME/zsh"
HISTFILE="$XDG_STATE_HOME/zsh/history"
HISTSIZE=20000
SAVEHIST=20000

# 记录时间戳
setopt extended_history
# 忽略重复
setopt hist_ignore_all_dups
setopt hist_ignore_dups
setopt hist_save_no_dups
# 忽略空格开头的命令
setopt hist_ignore_space
# 展开历史时不执行
setopt hist_verify
# 按执行顺序添加历史
setopt inc_append_history
# 更佳性能
setopt hist_fcntl_lock
# 实例之间即时共享历史
# setopt share_history
# 使用 fc -IR 读取历史  fc -IA 保存历史
