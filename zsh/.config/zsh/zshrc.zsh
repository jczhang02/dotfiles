# zsh config
## Chengrui Zhang <jczhang@live.it>

PROFILE_STARTUP=false
if [[ "$PROFILE_STARTUP" == true ]]; then
    zmodload zsh/zprof
    PS4=$'%D{%M%S%.} %N:%i> '
    exec 3>&2 2>$HOME/startlog.$$
    setopt xtrace prompt_subst
fi

# ==== TMUX ====

# 作为非 tmux 启动的交互式终端，考虑启动 tmux
if [[ ( ! "$(</proc/$PPID/cmdline)" =~ "tmux" ) && $- == *i* ]]; then
    # 非嵌入式终端，启动 tmux
    if [[ ! "$(</proc/$PPID/cmdline)" =~ "dolphin|emacs|kate|visual-studio-code|SCREEN|zsh" ]]; then
        exec tmux -f "$XDG_CONFIG_HOME/tmux/tmux.conf"
        # 非 SCREEN 窗口，unset 相关环境变量，避免被识别为 TMUX 环境
    elif [[ ! "$(</proc/$PPID/cmdline)" =~ "SCREEN" ]]; then
        unset TMUX TMUX_PANE
    fi
fi

# ==== p10k instant prompt ====
if [[ -r "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
    source "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# ==== Load zi ====
typeset -A ZI=(
    BIN_DIR         $ZDOTDIR/zi/bin
    HOME_DIR        $ZDOTDIR/zi
    COMPINIT_OPTS   -C
)
source "${ZI[BIN_DIR]}/zi.zsh"

autoload -Uz _zi
(( ${+_comps} )) && _comps[zi]=_zi

# ===== Load functions ====
autoload -Uz $XDG_CONFIG_HOME/zsh/functions/*(:t)
autoload -Uz zcalc zmv zargs

for i in $(command ls `dirname ${(%):-%N}`/zshrc.d/*.zsh | grep -v 00-source.zsh | sort)
do
    # echo CTG/zsh/zshrc: source $(basename $i)
    source $i
done
