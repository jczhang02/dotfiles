# zsh config
## Chengrui Zhang <jczhang@live.it>

PROFILE_STARTUP=false
if [[ "$PROFILE_STARTUP" == true ]]; then
    zmodload zsh/zprof
    PS4=$'%D{%M%S%.} %N:%i> '
    exec 3>&2 2>$HOME/startlog.$$
    setopt xtrace prompt_subst
fi

# ==== TMUX / sesh sessionizer ====
# 启动直接弹 sesh picker (per-project session model).
#   选中 → sesh connect (attach 或新建)
#   Esc 取消 → 退到普通 zsh shell, 不进 tmux
#   GC: 顺手清掉 main-<pid> 旧 grouped clone (历史遗留, 过渡期保留)
if [[ ( ! "$(</proc/$PPID/cmdline)" =~ "tmux" ) && $- == *i* ]]; then
    if [[ ! "$(</proc/$PPID/cmdline)" =~ "dolphin|emacs|kate|visual-studio-code|SCREEN|zsh" ]]; then
        local _tmux=("tmux" "-f" "$XDG_CONFIG_HOME/tmux/tmux.conf")
        # GC stale main-<pid> clones from old A3 grouped-session model
        if "${_tmux[@]}" has-session 2>/dev/null; then
            local _s _pid
            for _s in ${(f)"$("${_tmux[@]}" ls -F '#{session_name}' 2>/dev/null)"}; do
                [[ "$_s" == main-<-> ]] || continue
                _pid=${_s#main-}
                [[ -d /proc/$_pid ]] || "${_tmux[@]}" kill-session -t "$_s" 2>/dev/null
            done
        fi
        if command -v sesh >/dev/null 2>&1; then
            local _target
            _target=$(sesh list --icons 2>/dev/null | fzf --no-sort --ansi \
                --border --border-label ' sesh ' --prompt '⚡ ' --height 80% \
                --header '^a all  ^t tmux  ^g configs  ^x zoxide  ^d kill  ^f find' \
                --bind 'tab:down,btab:up' \
                --bind 'ctrl-a:change-prompt(⚡ )+reload(sesh list --icons)' \
                --bind 'ctrl-t:change-prompt(🪟 )+reload(sesh list -t --icons)' \
                --bind 'ctrl-g:change-prompt(⚙  )+reload(sesh list -c --icons)' \
                --bind 'ctrl-x:change-prompt(📁 )+reload(sesh list -z --icons)' \
                --bind 'ctrl-f:change-prompt(🔎 )+reload(fd -H -d 2 -t d -E .git . ~/dev)' \
                --bind 'ctrl-d:execute(tmux kill-session -t {2..})+change-prompt(⚡ )+reload(sesh list --icons)')
            if [[ -n "$_target" ]]; then
                _target="${_target#* }"   # strip icon prefix
                exec sesh connect "$_target"
            fi
            # Esc → fallthrough 进普通 shell
        else
            exec "${_tmux[@]}" new-session -A -s main
        fi
    elif [[ ! "$(</proc/$PPID/cmdline)" =~ "SCREEN" ]]; then
        unset TMUX TMUX_PANE
    fi
fi

# eval "$(zellij setup --generate-auto-start zsh)"

# ==== p10k instant prompt ====
if [[ -r "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
    source "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# ==== Load zi ====
typeset -A ZI=(
    BIN_DIR         $ZDOTDIR/zi/bin
    HOME_DIR        $ZDOTDIR/zi
    CONFIG_DIR      $ZDOTDIR/zi
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
