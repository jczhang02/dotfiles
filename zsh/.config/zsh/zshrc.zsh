# Zsh configuration
# Chengrui Zhang <jczhang@live.it>

zmodload zsh/terminfo 2>/dev/null

# ==== tmux / sesh sessionizer ====
function _zsh_maybe_start_sesh() {
    emulate -L zsh

    [[ -o interactive && -t 0 && -t 1 ]] || return 0
    (( ${terminfo[colors]:-0} >= 8 )) || return 0
    [[ -z ${ZSH_NO_SESSIONIZER:-} && -z ${TMUX:-} ]] || return 0
    [[ ${TERM_PROGRAM:-} != Orca ]] || return 0

    local parent=''
    if [[ -r /proc/$PPID/comm ]]; then
        IFS= read -r parent < "/proc/$PPID/comm"
    elif (( $+commands[ps] )); then
        parent=$(ps -o comm= -p "$PPID" 2>/dev/null)
    fi
    parent=${(L)parent}

    case $parent in
        *tmux* | *screen* | *zsh* | *dolphin* | *emacs* | *kate* | *code*)
            return 0
            ;;
    esac

    (( $+commands[sesh] && $+commands[fzf] && $+commands[tmux] )) || return 0

    local -a picker_options=(
        --no-sort --ansi
        --border --border-label=' sesh ' --prompt='⚡ ' --height=80%
        --header='^a sessions  ^t tmux  ^g configs  ^x zoxide  ^d kill  ^f find'
        --bind='tab:down,btab:up'
        --bind='ctrl-a:change-prompt(⚡ )+reload(sesh list -t -c -d --icons)'
        --bind='ctrl-t:change-prompt(🪟 )+reload(sesh list -t --icons)'
        --bind='ctrl-g:change-prompt(⚙  )+reload(sesh list -c --icons)'
        --bind='ctrl-x:change-prompt(📁 )+reload(sesh list -z --icons)'
        --bind='ctrl-d:execute(tmux kill-session -t {2..})+change-prompt(⚡ )+reload(sesh list -t -c -d --icons)'
    )
    if (( $+commands[fd] )); then
        picker_options+=(
            --bind='ctrl-f:change-prompt(🔎 )+reload(fd -H -d 2 -t d -E .git . ~/dev)'
        )
    fi

    local target
    target=$(sesh list -t -c -d --icons 2>/dev/null | fzf "${picker_options[@]}")

    [[ -n $target ]] || return 0
    target=${target#* }
    exec sesh connect "$target"
}
_zsh_maybe_start_sesh
unfunction _zsh_maybe_start_sesh

# ==== Powerlevel10k instant prompt ====
if [[ -o monitor ]] \
    && (( ${terminfo[colors]:-0} >= 256 )) \
    && [[ -r $XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh ]]; then
    source "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# ==== Zi ====
typeset -gA ZI=(
    BIN_DIR       "$XDG_DATA_HOME/zi/bin"
    HOME_DIR      "$XDG_DATA_HOME/zi"
    CACHE_DIR     "$XDG_CACHE_HOME/zi"
    CONFIG_DIR    "$XDG_CONFIG_HOME/zi"
)
# Override values inherited from terminals started before Zi moved out of the
# dotfiles repository. Zi otherwise keeps an existing ZPFX unchanged.
typeset -g ZPFX="${ZI[HOME_DIR]}/polaris"
typeset -gi ZI_AVAILABLE=0
if [[ -r ${ZI[BIN_DIR]}/zi.zsh ]]; then
    source "${ZI[BIN_DIR]}/zi.zsh"
    ZI_AVAILABLE=1
elif [[ -o interactive ]]; then
    print -u2 -- 'zsh: Zi is not installed; install z-shell/zi and restart Zsh.'
fi

# ==== Functions and numbered configuration ====
# Autoload files are Zsh function bodies and therefore intentionally have no
# extension. Executable helper scripts such as colors.py must not be parsed as
# shell functions.
typeset function_file
for function_file in "$XDG_CONFIG_HOME"/zsh/functions/*(.N); do
    [[ ${function_file:t} == *.* ]] && continue
    autoload -Uz "${function_file:t}"
done
unset function_file
autoload -Uz zcalc zmv zargs

for config_file in "$ZDOTDIR"/zshrc.d/*.zsh(N); do
    source "$config_file"
done
unset config_file

# ==== Machine-local helpers ====
for local_config in "$XDG_CONFIG_HOME"/zsh-local.d/*.zsh(N); do
    source "$local_config"
done
unset local_config

# Prefer standalone launchers and remove paths inherited from retired managers.
path=("$HOME/.local/bin" ${path:#$HOME/.local/bin})
path=(${path:#/condabin})
path=(${path:#/usr/condabin})
path=(${path:#$HOME/.cargo/bin})
path=(${path:#$HOME/.local/share/npm-global/bin})
path=(${path:#$HOME/.local/share/pnpm/bin})
path=(${path:#$HOME/.local/share/gem/bin})
path=(${path:#$HOME/.local/share/gomodule/bin})
path=(${path:#$HOME/.local/share/bob/nvim-bin})
path=(${path:#$HOME/.deno/bin})
path=(${path:#$HOME/.bun/bin})
path=(${path:#$HOME/.local/share/nvm/*})
path=(${path:#$ZDOTDIR/zi/*})
path=(${path:#${ZDOTDIR:A}/zi/*})

# mise recommends PATH activation for interactive shells. Keep this after all
# other PATH edits so mise owns the final tool ordering and environment hooks.
# Clean the saved base PATH inherited from shells started before Zi's XDG move.
if [[ -n ${__MISE_ORIG_PATH:-} ]]; then
    () {
        local -a original_path=("${(@s.:.)__MISE_ORIG_PATH}")
        original_path=(${original_path:#$ZDOTDIR/zi/*})
        original_path=(${original_path:#${ZDOTDIR:A}/zi/*})
        export __MISE_ORIG_PATH="${(j.:.)original_path}"
    }
fi
eval "$(mise activate zsh)"
path=(${path:#$ZDOTDIR/zi/*})
path=(${path:#${ZDOTDIR:A}/zi/*})

# mise rebuilds PATH during activation. Restore an inherited active mamba
# environment with mamba's own reactivation output after that final rebuild.
if (( ${CONDA_SHLVL:-0} > 0 && $+commands[mamba] )) \
    && [[ -n ${CONDA_PREFIX:-} ]]; then
    eval "$(command mamba shell reactivate --shell zsh)"
fi

# A nested shell inherits VIRTUAL_ENV, but mise may place its bin directory
# behind system tools while rebuilding PATH. Keep an active standard venv first.
if [[ -n ${VIRTUAL_ENV:-} && -d $VIRTUAL_ENV/bin ]]; then
    path=("$VIRTUAL_ENV/bin" ${path:#$VIRTUAL_ENV/bin})
fi
