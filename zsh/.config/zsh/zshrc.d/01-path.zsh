# ==== Path & environment ====

typeset -U path PATH
typeset -U fpath FPATH

path=(
    "$HOME/.local/bin"
    "$XDG_CONFIG_HOME/zsh/commands"
    "$XDG_DATA_HOME/bin"
    $path
)

fpath=(
    "$XDG_CONFIG_HOME/zsh/completions"
    "$XDG_CONFIG_HOME/zsh/functions"
    $fpath
)
# Remove Zi paths inherited from shells that predate the XDG data migration.
fpath=(${fpath:#$ZDOTDIR/zi/*})
fpath=(${fpath:#${ZDOTDIR:A}/zi/*})
fpath=(${fpath:#rust/_rustc})
mailpath=(${mailpath:#$ZDOTDIR/zi/*})
mailpath=(${mailpath:#${ZDOTDIR:A}/zi/*})

# ==== Applications ====
if [[ -z ${BROWSER:-} ]]; then
    if (( $+commands[google-chrome-stable] )); then
        export BROWSER=google-chrome-stable
    elif (( $+commands[google-chrome] )); then
        export BROWSER=google-chrome
    fi
fi

# Remove variables exported by retired integrations from long-lived shells.
unset FORCE_COLOR MULTICA_WORKSPACES_ROOT OPENCODE_PORT ZSQLITE_ZSH_SRC_VERSION
unset OPENCODE_EXPERIMENTAL_WORKSPACES OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS
unset OPENCODE_EXPERIMENTAL_PLAN_MODE OPENCODE_EXPERIMENTAL_SCOUT
unset OPENCODE_EXPERIMENTAL_LSP_TOOL OPENCODE_EXPERIMENTAL_OXFMT
unset OPENCODE_EXPERIMENTAL_ICON_DISCOVERY OPENCODE_EXPERIMENTAL_NATIVE_LLM
if [[ ${FORGIT_INSTALL_DIR:-} == $ZDOTDIR/zi/* \
    || ${FORGIT_INSTALL_DIR:-} == ${ZDOTDIR:A}/zi/* ]]; then
    unset FORGIT_INSTALL_DIR
fi

# ==== Language runtimes ====
unset NVM_DIR NVM_COMPLETION NPM_CONFIG_USERCONFIG

if (( $+commands[rustup] )); then
    export RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup
else
    unset RUSTUP_DIST_SERVER
fi

export GOPATH="$XDG_DATA_HOME/gomodule"
export R_LIBS_USER="$XDG_DATA_HOME/R"

# ==== Jupyter XDG directories ====
export JUPYTER_CONFIG_DIR="$XDG_CONFIG_HOME/jupyter"
export JUPYTER_DATA_DIR="$XDG_DATA_HOME/jupyter"
export JUPYTERLAB_SETTINGS_DIR="$JUPYTER_CONFIG_DIR/lab/user-settings"
export JUPYTERLAB_WORKSPACES_DIR="$JUPYTER_CONFIG_DIR/lab/workspaces"
if [[ -n ${XDG_RUNTIME_DIR:-} ]]; then
    export JUPYTER_RUNTIME_DIR="$XDG_RUNTIME_DIR/jupyter"
else
    unset JUPYTER_RUNTIME_DIR
fi

# ==== Completion and fuzzy finding ====
SPROMPT="%B%F{yellow}zsh: correct '%R' be '%r' [nyae]?%f%b "

if (( ${terminfo[colors]:-0} >= 256 )); then
    if (( $+commands[vivid] )); then
        export LS_COLORS="$(vivid generate catppuccin-latte)"
    fi
    export FZF_DEFAULT_OPTS='--color=bg+:#ccd0da,bg:#eff1f5,spinner:#dc8a78,hl:#d20f39
--color=fg:#4c4f69,header:#d20f39,info:#8839ef,pointer:#dc8a78
--color=marker:#7287fd,fg+:#4c4f69,prompt:#8839ef,hl+:#d20f39
--color=selected-bg:#bcc0cc,border:#9ca0b0,label:#4c4f69'
else
    unset LS_COLORS FZF_DEFAULT_OPTS
fi
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_CTRL_T_COMMAND=$FZF_DEFAULT_COMMAND
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'
export FZF_CTRL_T_OPTS="--preview 'fzf-preview {}' --preview-window=right:60%:wrap"
export FZF_ALT_C_OPTS="--preview 'fzf-preview {}' --preview-window=right:60%:wrap"

# ==== Application-specific XDG paths ====
export LESSHISTFILE="$XDG_STATE_HOME/lesshst"

if [[ -x $HOME/.maestro/bin/maestro ]]; then
    path=("$HOME/.maestro/bin" $path)
fi
