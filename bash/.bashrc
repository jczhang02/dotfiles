# shellcheck shell=bash

[[ $- != *i* ]] && return

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

export EDITOR=nvim
export VISUAL=nvim
export HISTCONTROL=ignoreboth

# Maestro is installed separately from mise.
if [[ -x "$HOME/.maestro/bin/maestro" ]]; then
    case ":$PATH:" in
        *":$HOME/.maestro/bin:"*) ;;
        *) export PATH="$HOME/.maestro/bin:$PATH" ;;
    esac
fi

if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash)"
elif [[ -x "$HOME/.local/bin/mise" ]]; then
    eval "$("$HOME/.local/bin/mise" activate bash)"
fi

if command -v mamba >/dev/null 2>&1; then
    export MAMBA_ROOT_PREFIX="$XDG_DATA_HOME/mamba"
    eval "$(mamba shell hook --shell bash)"
fi

alias vim=nvim
