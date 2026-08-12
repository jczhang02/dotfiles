export XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}
export XDG_CACHE_HOME=${XDG_CACHE_HOME:-$HOME/.cache}
export XDG_DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
export XDG_STATE_HOME=${XDG_STATE_HOME:-$HOME/.local/state}
export OP_CONFIG_DIR=${OP_CONFIG_DIR:-$XDG_CONFIG_HOME/op}

export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

typeset -U path PATH
path=(
    "$HOME/.local/bin"
    "$XDG_CONFIG_HOME/zsh/commands"
    "$XDG_DATA_HOME/bin"
    $path
)
if [[ -x $HOME/.maestro/bin/maestro ]]; then
    path=("$HOME/.maestro/bin" $path)
fi

export PI_CODING_AGENT_DIR="$XDG_CONFIG_HOME/pi"
export PI_CODING_AGENT_SESSION_DIR="$XDG_STATE_HOME/pi/sessions"

export GOPATH="$XDG_DATA_HOME/gomodule"
export R_LIBS_USER="$XDG_DATA_HOME/R"

export JUPYTER_CONFIG_DIR="$XDG_CONFIG_HOME/jupyter"
export JUPYTER_DATA_DIR="$XDG_DATA_HOME/jupyter"
export JUPYTERLAB_SETTINGS_DIR="$JUPYTER_CONFIG_DIR/lab/user-settings"
export JUPYTERLAB_WORKSPACES_DIR="$JUPYTER_CONFIG_DIR/lab/workspaces"
if [[ -n ${XDG_RUNTIME_DIR:-} ]]; then
    export JUPYTER_RUNTIME_DIR="$XDG_RUNTIME_DIR/jupyter"
else
    unset JUPYTER_RUNTIME_DIR
fi

export MAMBA_ROOT_PREFIX="$XDG_DATA_HOME/mamba"
export LESSHISTFILE="$XDG_STATE_HOME/lesshst"

# rclone FUSE mount: stat 会触发 ~1.1s 的远程握手, 排除以免拖慢 zoxide/sesh picker
export _ZO_EXCLUDE_DIRS="$HOME/Documents/sync/**"
