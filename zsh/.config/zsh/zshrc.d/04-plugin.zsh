# ==== Plugins and completion ====

if (( ${ZI_AVAILABLE:-0} )); then
    # Keep the Linux/portable completion sets without the plugin's macOS fpath.
    zi ice as'null' nocompletions
    zi light zchee/zsh-completions
    fpath=(
        "$XDG_CONFIG_HOME/zsh/completions"
        "$XDG_CONFIG_HOME/zsh/functions"
        $fpath
        "${ZI[PLUGINS_DIR]}/zchee---zsh-completions/src/go"
        "${ZI[PLUGINS_DIR]}/zchee---zsh-completions/src/zsh"
    )
fi

() {
    local cache_dir="$XDG_CACHE_HOME/zsh"

    command mkdir -p -m 700 -- "$cache_dir/.zcompcache"
    zstyle ':completion:*' use-cache true
    zstyle ':completion:*' cache-path "$cache_dir/.zcompcache"

    autoload -Uz compinit
    compinit -d "$cache_dir/.zcompdump"
}
(( $+functions[zpcdreplay] )) && zpcdreplay

if (( $+commands[mamba] )); then
    export MAMBA_ROOT_PREFIX="$XDG_DATA_HOME/mamba"
    command mkdir -p -- "$MAMBA_ROOT_PREFIX"
    eval "$(mamba shell hook --shell zsh)"

    # mamba 2.5 registers its generated completion under micromamba.
    (( ${+_comps[micromamba]} )) && _comps[mamba]=${_comps[micromamba]}
fi

if (( $+commands[zoxide] )); then
    # Drop only values left by the retired wrapper; preserve user zoxide options.
    if [[ ${_ZO_DATA_DIR:-} == $ZDOTDIR/zi/* \
        || ${_ZO_DATA_DIR:-} == ${ZDOTDIR:A}/zi/* ]]; then
        unset _ZO_DATA_DIR
    fi
    unset _ZO_CMD_PREFIX
    eval "$(zoxide init zsh --cmd j)"
    alias z=j
fi

if (( ${ZI_AVAILABLE:-0} )); then
    autoload -Uz _zi
    (( ${+_comps} )) && _comps[zi]=_zi
fi

# Editing plugins load before custom widgets are bound.
if (( ${ZI_AVAILABLE:-0} )); then
    zi light-mode for \
        softmoth/zsh-vim-mode \
        Aloxaf/fzf-tab \
        hchbaw/zce.zsh
fi

# Local plugins kept by policy. systemd aliases intentionally remain unchanged.
source "$ZDOTDIR/plugins/alias-tips/alias-tips.plugin.zsh"
source "$ZDOTDIR/plugins/gentoo_alias/gentoo-alias.plugin.zsh"
source "$ZDOTDIR/plugins/zsh-systemd/zsh-systemd.plugin.zsh"

source "$ZDOTDIR/snippets/alias.zsh"
source "$ZDOTDIR/snippets/keybinds.zsh"

# Autopair wraps the final insert-mode bindings instead of being overwritten.
(( ${ZI_AVAILABLE:-0} )) && zi light hlissner/zsh-autopair
# Autopair treats Ctrl-H as a one-character backspace by default. In this
# terminal mapping Ctrl-Backspace emits Ctrl-H, so retain word deletion while
# keeping Autopair's pair-aware wrapper.
if (( ${+widgets[autopair-delete-word]} )); then
    bindkey -M viins '^H' autopair-delete-word
fi

# Low-frequency integrations are deferred until after the first prompt.
if (( ${ZI_AVAILABLE:-0} )); then
    zi wait='0' lucid light-mode for \
        ver'main' wfxr/forgit

    zi wait='1' lucid for \
        OMZL::clipboard.zsh \
        OMZL::git.zsh \
        OMZP::git/git.plugin.zsh \
        OMZP::extract \
        ver'main' MenkeTechnologies/zsh-cargo-completion

    zi ice wait='0' lucid as'program' pick'bin/git-fuzzy'
    zi load bigH/git-fuzzy

    # Preview sources load after the first prompt; the local safe fallback is
    # applied after their widgets become available.
    zi ice wait='1' lucid \
        atload="source '$ZDOTDIR/snippets/zz-fzf-tab-fix.zsh'"
    zi load Freed-Wu/fzf-tab-source
fi

(( ${ZI_AVAILABLE:-0} )) && zi light zsh-users/zsh-autosuggestions
