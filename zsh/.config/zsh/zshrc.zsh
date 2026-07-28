# Zsh configuration
# Chengrui Zhang <jczhang@live.it>

# ==== Optional one-shot startup profile ====
typeset -gi ZSH_PROFILE_ACTIVE=0
if [[ ${ZSH_PROFILE:-0} == 1 ]]; then
    zmodload zsh/zprof
    ZSH_PROFILE_ACTIVE=1
fi

# ==== tmux / sesh sessionizer ====
function _zsh_maybe_start_sesh() {
    emulate -L zsh

    [[ -o interactive && -t 0 && -t 1 ]] || return 0
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
        --header='^a all  ^t tmux  ^g configs  ^x zoxide  ^d kill  ^f find'
        --bind='tab:down,btab:up'
        --bind='ctrl-a:change-prompt(⚡ )+reload(sesh list --icons)'
        --bind='ctrl-t:change-prompt(🪟 )+reload(sesh list -t --icons)'
        --bind='ctrl-g:change-prompt(⚙  )+reload(sesh list -c --icons)'
        --bind='ctrl-x:change-prompt(📁 )+reload(sesh list -z --icons)'
        --bind='ctrl-d:execute(tmux kill-session -t {2..})+change-prompt(⚡ )+reload(sesh list --icons)'
    )
    if (( $+commands[fd] )); then
        picker_options+=(
            --bind='ctrl-f:change-prompt(🔎 )+reload(fd -H -d 2 -t d -E .git . ~/dev)'
        )
    fi

    local target
    target=$(sesh list --icons 2>/dev/null | fzf "${picker_options[@]}")

    [[ -n $target ]] || return 0
    target=${target#* }
    exec sesh connect "$target"
}
_zsh_maybe_start_sesh
unfunction _zsh_maybe_start_sesh

# ==== Powerlevel10k instant prompt ====
if [[ -r $XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh ]]; then
    source "$XDG_CACHE_HOME/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# ==== Zi ====
typeset -gA ZI=(
    BIN_DIR       "$ZDOTDIR/zi/bin"
    HOME_DIR      "$ZDOTDIR/zi"
    CONFIG_DIR    "$ZDOTDIR/zi"
    COMPINIT_OPTS -C
)
typeset -gi ZI_AVAILABLE=0
typeset -gi ZSH_PLUGINS_READY=0
if [[ -r ${ZI[BIN_DIR]}/zi.zsh ]]; then
    source "${ZI[BIN_DIR]}/zi.zsh"
    ZI_AVAILABLE=1
elif [[ -o interactive ]]; then
    print -u2 -- "zsh: Zi is not installed; run zsh-setup from an interactive terminal."
fi

# ==== Functions and numbered configuration ====
autoload -Uz "$XDG_CONFIG_HOME"/zsh/functions/*(.N:t)
autoload -Uz zcalc zmv zargs

for config_file in "$ZDOTDIR"/zshrc.d/*.zsh(N); do
    source "$config_file"
done
unset config_file

# ==== Machine-local non-secret helpers ====
function _zsh_source_local_dir() {
    emulate -L zsh
    local -r local_dir="$XDG_CONFIG_HOME/zsh-local.d"
    [[ -d $local_dir ]] || return 0

    local mode file
    if [[ ! -O $local_dir ]]; then
        print -u2 -- "zsh: skipping $local_dir: not owned by the current user"
        return 0
    fi
    mode=$(stat -c '%a' -- "$local_dir" 2>/dev/null) || return 0
    if (( (8#$mode & 8#022) != 0 )); then
        print -u2 -- "zsh: skipping $local_dir: group/other writable"
        return 0
    fi

    for file in "$local_dir"/*.zsh(N); do
        if [[ ! -O $file ]]; then
            print -u2 -- "zsh: skipping $file: not owned by the current user"
            continue
        fi
        mode=$(stat -c '%a' -- "$file" 2>/dev/null) || continue
        if (( (8#$mode & 8#022) != 0 )); then
            print -u2 -- "zsh: skipping $file: group/other writable"
            continue
        fi
        source "$file"
    done
}
_zsh_source_local_dir
unfunction _zsh_source_local_dir

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
path=(${path:#$ZDOTDIR/zi/plugins/lilydjwg---search-and-view})

if (( ZSH_PROFILE_ACTIVE )); then
    local_profile_dir="$XDG_CACHE_HOME/zsh"
    command mkdir -p -m 700 -- "$local_profile_dir"
    local_profile_file="$local_profile_dir/zprof-$$.log"
    zprof >| "$local_profile_file"
    command chmod 600 -- "$local_profile_file"
    print -u2 -- "zsh profile: $local_profile_file"
    unset local_profile_dir local_profile_file
fi
