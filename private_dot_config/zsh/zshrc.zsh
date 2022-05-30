# eval "$(starship init zsh)"

if [[ -z $TMUX && $- == *i* ]]; then
    if [[ ! "$(</proc/$PPID/cmdline)" =~ "/usr/bin/(dolphin|emacs|kate)|visual-studio-code" ]]; then
        exec tmux -f "$XDG_CONFIG_HOME/tmux/tmux.conf"
    fi
else
    if [[ "$(</proc/$PPID/cmdline)" =~ "konsole" ]]; then
        unset TMUX TMUX_PANE
    fi
fi

if [ -z "$TMUX" ]
then
    tmux
fi

TRAPWINCH() {
  zle && { zle reset-prompt; zle -R }
}

typeset -A ZINIT=(
    BIN_DIR         $ZDOTDIR/zinit/bin
    HOME_DIR        $ZDOTDIR/zinit
    COMPINIT_OPTS   -C
)

source $ZDOTDIR/zinit/bin/zinit.zsh

# Proxy Settings
export ALL_PROXY=http://127.0.0.1:7890
export PATH=~/.npm-global/bin:$PATH


PATH=$XDG_CONFIG_HOME/zsh/commands:$PATH
FPATH=$XDG_CONFIG_HOME/zsh/functions:$XDG_CONFIG_HOME/zsh/completions:$FPATH
# fpath+=("$XDG_CONFIG_HOME/zsh/functions" "$XDG_CONFIG_HOME/zsh/completions")



autoload -Uz $XDG_CONFIG_HOME/zsh/functions/*(:t)
autoload +X zman
autoload -Uz zcalc zmv zargs

ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="underline"
HISTDB_FILE=$ZDOTDIR/.histdb/zsh-history.db
# return the latest used command in the current directory
_zsh_autosuggest_strategy_histdb_top_here() {
    (( $+functions[_histdb_query] )) || return
    local query="
SELECT commands.argv
FROM   history
    LEFT JOIN commands
        ON history.command_id = commands.rowid
    LEFT JOIN places
        ON history.place_id = places.rowid
WHERE commands.argv LIKE '${1//'/''}%'
-- GROUP BY 会导致旧命令的新记录不生效
-- GROUP BY commands.argv
ORDER BY places.dir != '${PWD//'/''}',
	history.start_time DESC
LIMIT 1
"
    typeset -g suggestion=$(_histdb_query "$query")
}

# _zsh_autosuggest_strategy_histdb_top_here() {
#     local query="select commands.argv from
# history left join commands on history.command_id = commands.rowid
# left join places on history.place_id = places.rowid
# where places.dir LIKE '$(sql_escape $PWD)%'
# and commands.argv LIKE '$(sql_escape $1)%'
# group by commands.argv order by count(*) desc limit 1"
#     suggestion=$(_histdb_query "$query")
# }
#
ZSH_AUTOSUGGEST_STRATEGY=(histdb_top_here match_prev_cmd completion)
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
ZSH_AUTOSUGGEST_USE_ASYNC=1
ZSH_AUTOSUGGEST_MANUAL_REBIND=1
ZSH_AUTOSUGGEST_COMPLETION_IGNORE='( |man |pikaur -S )*'
ZSH_AUTOSUGGEST_HISTORY_IGNORE='?(#c50,)'

GENCOMP_DIR=$XDG_CONFIG_HOME/zsh/completions

forgit_add=gai
forgit_diff=gdi
forgit_log=glgi

ZSHZ_DATA=$ZDOTDIR/.z

# for python-better-expections
export FORCE_COLOR=1


# source $HOME/.oh-my-zsh/custom/plugins/zsh-histdb/sqlite-history.zsh
# autoload -Uz add-zsh-hook

zinit wait="0" lucid light-mode for \
    hlissner/zsh-autopair \
    Aloxaf/gencomp \
    wfxr/forgit \
    hchbaw/zce.zsh \
	Aloxaf/zsh-histdb

# the first call of zsh-z is slow in HDD, so call it in advance
zinit ice wait="0" lucid atload="zshz >/dev/null"
zinit light agkozak/zsh-z


zinit light-mode for \
    blockf \
        zsh-users/zsh-completions \
    as="program" atclone="rm -f ^(rgg|agv)" \
        lilydjwg/search-and-view \
    atclone="dircolors -b LS_COLORS > c.zsh" atpull='%atclone' pick='c.zsh' \
        trapd00r/LS_COLORS \
    src="etc/git-extras-completion.zsh" \
        tj/git-extras

zinit wait="1" lucid for \
    OMZL::clipboard.zsh \
    OMZL::git.zsh \
    OMZP::systemd/systemd.plugin.zsh \
    OMZP::sudo/sudo.plugin.zsh \
    OMZP::git/git.plugin.zsh \
    OMZ::plugins/extract \
    OMZ::plugins/rust \
    # OMZ::lib/history.zsh \
	# OMZP::per-directory-history/per-directory-history.zsh

zinit ice mv=":cht.sh -> cht.sh" atclone="chmod +x cht.sh" as="program"
zinit snippet https://cht.sh/:cht.sh

zinit ice mv=":zsh -> _cht" as="completion"
zinit snippet https://cheat.sh/:zsh

zinit as="completion" for \
    OMZP::docker/_docker \
    OMZP::fd/_fd

zpcompinit; zpcdreplay

for i in $XDG_CONFIG_HOME/zsh/snippets/*.zsh; do
    source $i
done

for i in $XDG_CONFIG_HOME/zsh/plugins/*/*.plugin.zsh; do
    source $i
done

zinit light esc/conda-zsh-completion


zinit light hchbaw/zce.zsh
zstyle ':zce:*' keys 'asdghklqwertyuiopzxcvbnmfj;23456789'

zinit light zsh-users/zsh-history-substring-search
bindkey -M emacs '^P' history-substring-search-up
bindkey -M emacs '^N' history-substring-search-down

zinit light Aloxaf/fzf-tab
zstyle ':fzf-tab:complete:_zlua:*' query-string input
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview 'ps --pid=$word -o cmd --no-headers -w -w'
zstyle ':fzf-tab:complete:kill:argument-rest' fzf-flags '--preview-window=down:3:wrap'
zstyle ':fzf-tab:complete:kill:*' popup-pad 0 3
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'exa -1 --color=always $realpath'
zstyle ':fzf-tab:complete:cd:*' popup-pad 30 0
zstyle ":fzf-tab:*" fzf-flags --color=bg+:23
zstyle ':fzf-tab:*' fzf-command ftb-tmux-popup
zstyle ':fzf-tab:*' switch-group ',' '.'
zstyle ":completion:*:git-checkout:*" sort false
zstyle ':completion:*' file-sort modification
zstyle ':completion:*:exa' sort false
zstyle ':completion:files' sort false
zstyle ':fzf-tab:*:*argument-rest*' popup-pad 100 0
zstyle ':fzf-tab:*:*argument-rest*' fzf-preview

zinit ice lucid wait='0' atinit='zpcompinit'
zinit light zdharma-continuum/fast-syntax-highlighting

zinit ice lucid wait="0" atload='_zsh_autosuggest_start'
zinit light zsh-users/zsh-autosuggestions

zinit ice lucid wait='0'
zinit light zsh-users/zsh-completions

source /usr/share/fzf/completion.zsh
source /usr/share/fzf/key-bindings.zsh

eval $(thefuck --alias)

# ==== load alias ====
alias setproxy="export ALL_PROXY=http://127.0.0.1:7890"
alias unsetproxy="unset ALL_PROXY"
alias ls="lsd"
alias viim="nvim"
alias zshconfig="nvim /home/jczhang/.config/zsh/zshrc.zsh"
alias ts="task sync"
alias latexinit="python ~/Documents/Study/University/university-setup/scripts/init-all-courses.py"
alias rm="trash-put"
alias ks="kdeconnect-cli --device=02b6abe1fcc3cb13 --share"
alias ts="task sync"
alias tres="proxychains trellowarrior sync"
alias cpaper="cd /home/jczhang/Paper/elsevier"

# ==== conda initialize ====
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/opt/anaconda/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/opt/anaconda/etc/profile.d/conda.sh" ]; then
        . "/opt/anaconda/etc/profile.d/conda.sh"
    else
        export PATH="/opt/anaconda/bin:$PATH"
    fi
fi
unset __conda_setup

zmodload zsh/zprof
#export PATH=/home/jczhang/bin:$PATH

zinit ice depth=1; 
zinit light romkatv/powerlevel10k

if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi



# ==== load theme ====
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

[[ -s /etc/profile.d/autojump.sh ]] && source /etc/profile.d/autojump.sh
