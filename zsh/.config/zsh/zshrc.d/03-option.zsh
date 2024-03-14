# ==== Option ====

# completion

# 禁用旧补全系统
zstyle ':completion:*' use-compctl false

compctl() {
    print -P "\n%F{red}Don't use compctl anymore%f"
}

# 缓存补全结果
zstyle ':completion:*:complete:*' use-cache true
zstyle ':completion:*:complete:*' cache-policy _aloxaf_caching_policy
_aloxaf_caching_policy() {
    # 缓存策略：若不存在或 14 天以前则认定为失效
    [[ ! -f $1 && -n "$1"(Nm+14) ]]
}

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
zstyle ':completion:*' menu yes select # search
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

# 补全第三方 Git 子命令
# 直接用 git-extras 提供的补全更好
# zstyle ':completion:*:*:git:*' user-commands ${${(M)${(k)commands}:#git-*}/git-/}

# zwc 什么的忽略掉吧
# FIXME: 导致 zmodload 的补全结果出现其他文件
# zstyle ':completion:*:*:*:*'   file-patterns '^*.(zwc|pyc):compiled-files' '*:all-files'
# zstyle ':completion:*:*:rm:*'  file-patterns '*:all-files'
# zstyle ':completion:*:*:gio:*' file-patterns '*:all-files'

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
setopt correct

## auto slash
zstyle ':completion:*' special-dirs true
setopt autoparamslash

## select word style: smart quick delete and move
autoload -U select-word-style
select-word-style bash

## FUNCNEST
export FUNCNEST=1000

## zsh-histdb
HISTDB_FILE=$ZDOTDIR/history/zsh-history.db

## zsh-zsh-autosuggestions
_zsh_autosuggest_strategy_histdb_top_here() {
    emulate -L zsh
    (( $+functions[_histdb_query] && $+builtins[zsqlite_exec] )) || return
    _histdb_init
    local last_cmd="$(sql_escape ${history[$((HISTCMD-1))]})"
    local cmd="$(sql_escape $1)"
    local pwd="$(sql_escape $PWD)"
    local reply=$(zsqlite_exec _HISTDB "
SELECT argv FROM (
	SELECT c1.argv, p1.dir, h1.session, h1.start_time, 1 AS priority
	FROM history h1, history h2
		LEFT JOIN commands c1 ON h1.command_id = c1.ROWID
		LEFT JOIN commands c2 ON h2.command_id = c2.ROWID
		LEFT JOIN places p1   ON h1.place_id = p1.ROWID
	WHERE h1.ROWID = h2.ROWID + 1
		AND c1.argv LIKE '$cmd%'
		AND c2.argv = '$last_cmd'
		AND h1.exit_status = 0
    UNION
	SELECT c1.argv, p1.dir, h1.session, h1.start_time, 0 AS priority
	FROM history h1
		LEFT JOIN commands c1 ON h1.command_id = c1.ROWID
		LEFT JOIN places p1   ON h1.place_id = p1.ROWID
	WHERE c1.argv LIKE '$cmd%'
)
ORDER BY dir != '$pwd', priority DESC, session != $HISTDB_SESSION, start_time DESC
LIMIT 1
    ")
    typeset -g suggestion=$reply
}

ZSH_AUTOSUGGEST_STRATEGY=(histdb_top_here match_prev_cmd completion)
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_COMPLETION_IGNORE='( |man |pikaur -S )*'
ZSH_AUTOSUGGEST_HISTORY_IGNORE='?(#c50,)'
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="bold,underline"



## gencomp
GENCOMP_DIR=$XDG_CONFIG_HOME/zsh/completions

## zce
zstyle ':zce:*' keys 'asdghklqwertyuiopzxcvbnmfj;23456789'

## fzf-tab
zstyle ':fzf-tab:complete:_zlua:*' query-string input
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview 'ps --pid=$word -o cmd --no-headers -w -w'
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-flags '--preview-window=down:3:wrap'
zstyle ':fzf-tab:complete:kill:*' popup-pad 30 0
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --color=always --ignore-glob="*.bbl|*.aux|*.blg|*.fdb_latexmk|*.fls|*.log|*.synctex.gz|indent.log|*.pyg" $realpath'
zstyle ':fzf-tab:complete:cd:*' popup-pad 0 3
zstyle ':fzf-tab:*' fzf-flags --color=light
zstyle ':fzf-tab:*' popup-min-size 100 8

# zstyle ':fzf-tab:*' fzf-command ftb-tmux-popup
zstyle ':fzf-tab:*' switch-group ',' '.'

zstyle ':fzf-tab:*' default-color $'\033[94m'

zstyle ":completion:*:git-checkout:*" sort false
zstyle ':completion:*' file-sort modification
zstyle ':completion:*:exa' sort false
zstyle ':completion:files' sort false
zstyle ':fzf-tab:*:*argument-rest*' popup-pad 100 8
zstyle ':fzf-tab:*:*argument-rest*' fzf-preview

## vimmode
KEYTIMEOUT=0

## zsh-z
ZSHZ_DATA="$XDG_CONFIG_HOME/zsh/history/zsh_z.data"
ZSHZ_CASE=smart

## history
autoload -Uz add-zsh-hook
add-zsh-hook zshaddhistory max_history_len
function max_history_len() {
    if (($#1 > 240)) {
        return 2
    }
    return 0
}

HISTFILE="$ZDOTDIR/.zsh_history"
HISTSIZE=50000
SAVEHIST=100000

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
