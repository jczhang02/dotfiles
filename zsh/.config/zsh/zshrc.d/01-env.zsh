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
unset NVM_DIR NVM_COMPLETION NPM_CONFIG_USERCONFIG RUSTUP_DIST_SERVER

if (( ${terminfo[colors]:-0} >= 256 )); then
    if (( $+commands[vivid] )); then
        export LS_COLORS="$(vivid generate catppuccin-latte)"
    fi
    # Ghostty switches Latte/Mocha at runtime, but this is exported once per
    # shell, so fzf takes no fixed background: text and background follow the
    # terminal (-1), matches use ANSI red (Ghostty's theme gives each variant its
    # own), and the rest is the pink accent and greys that read on both: #8c8fa1
    # for lines, the darker #7c7f93 for secondary text. The current line is the
    # pink bar plus bold, with a blank gutter; a tinted row would need a colour
    # per theme.
    export FZF_DEFAULT_OPTS='--gutter=" "
--color=fg:-1,bg:-1,fg+:-1:bold,bg+:-1,selected-bg:-1
--color=hl:1,hl+:1:bold,query:-1:bold,prompt:-1:bold,header:-1,label:-1
--color=pointer:#dd4fa5,marker:#dd4fa5,spinner:#dd4fa5
--color=border:#8c8fa1,separator:#8c8fa1,scrollbar:#8c8fa1,info:#7c7f93,ghost:#7c7f93'
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
