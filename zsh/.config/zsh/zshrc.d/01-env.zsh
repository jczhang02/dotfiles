# ==== Interactive environment ====

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
unset NVM_DIR NVM_COMPLETION NPM_CONFIG_USERCONFIG

if (( $+commands[rustup] )); then
    export RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup
else
    unset RUSTUP_DIST_SERVER
fi

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

export MANPAGER="sh -c 'col -bx | bat -l man -p'"
export MANROFFOPT='-c'
