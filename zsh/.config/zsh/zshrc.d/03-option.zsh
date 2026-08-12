# ==== Option ====

# completion

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

## MANPAGER
export MANPAGER="sh -c 'col -bx | bat -l man -p'"
export MANROFFOPT='-c'

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
zstyle ':fzf-tab:complete:kill:*' popup-pad 30 0
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --color=always --ignore-glob="*.bbl|*.aux|*.blg|*.fdb_latexmk|*.fls|*.log|*.synctex.gz|indent.log|*.pyg" "$realpath"'
zstyle ':fzf-tab:complete:cd:*' popup-pad 0 3
zstyle ':fzf-tab:*' popup-min-size 100 8

# fzf-tab 使用 tmux popup 浮窗, 智能跟随光标位置 (空间不足时翻到光标上方).
# 2026-05-19: A3 grouped session 下 popup 浮到其他 client, 按 Tab 如同卡死
# (popup 进程在另一 session 无人交互). 故 grouped / detached session 回退行内
# fzf; 非 tmux 环境或未安装 fzf-tab 脚本时同样回退. 同名函数 + command 调用
# 外部脚本, 让 fzf-tab 仍识别为 ftb-tmux-popup 以保持其 popup 专用终端处理.
# fzf-tab 新版把 ftb-tmux-popup 移到 lib/ 不在 PATH, 这里自愈软链到 ~/.local/bin.
() {
    (( $+commands[ftb-tmux-popup] )) && return
    local popup_script="${ZI[HOME_DIR]:-$XDG_DATA_HOME/zi}/plugins/Aloxaf---fzf-tab/lib/ftb-tmux-popup"
    [[ -x $popup_script ]] || return
    command mkdir -p -- "$HOME/.local/bin"
    command ln -sf -- "$popup_script" "$HOME/.local/bin/ftb-tmux-popup"
}
function ftb-tmux-popup() {
    # grouped=1 时 popup 会浮到其他 client; attached=0 (detached) 时 popup 无人可见.
    local -a tmux_state=( ${(s: :)$(command tmux display-message -p '#{session_grouped} #{session_attached}' 2>/dev/null)} )
    if (( $+commands[ftb-tmux-popup] )) && [[ -n ${TMUX_PANE:-} ]] \
        && [[ ${tmux_state[1]:-1} != 1 && ${tmux_state[2]:-0} -ge 1 ]]; then
        command ftb-tmux-popup "$@"
    else
        command fzf "$@"
    fi
}
zstyle ':fzf-tab:*' fzf-command ftb-tmux-popup
zstyle ':fzf-tab:*' switch-group ',' '.'

zstyle ":completion:*:git-checkout:*" sort false
zstyle ':completion:*' file-sort modification
zstyle ':completion:*:*:eza:*' sort false
zstyle ':completion:files' sort false
zstyle ':fzf-tab:*:*argument-rest*' popup-pad 100 8
zstyle ':fzf-tab:*:*argument-rest*' fzf-preview

zstyle ':fzf-tab:complete:git-(add|diff|restore):*' fzf-preview \
    'git diff -- "$word" | delta'
zstyle ':fzf-tab:complete:git-log:*' fzf-preview \
    'git log --color=always "$word" --'
zstyle ':fzf-tab:complete:git-help:*' fzf-preview \
    'git help "$word" | bat -plman --color=always'
zstyle ':fzf-tab:complete:git-show:*' fzf-preview \
    'case "$group" in
	"commit tag") git show --color=always "$word" -- ;;
	*) git show --color=always "$word" -- | delta ;;
esac'
zstyle ':fzf-tab:complete:git-checkout:*' fzf-preview \
    'case "$group" in
	"modified file") git diff -- "$word" | delta ;;
	"recent commit object name") git show --color=always "$word" -- | delta ;;
	*) git log --color=always "$word" -- ;;
esac'

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
