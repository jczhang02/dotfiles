# ==== Plugins and completion ====

function _zsh_compinit_once() {
    emulate -L zsh
    local -r cache_dir=${XDG_CACHE_HOME:-$HOME/.cache}/zsh

    command mkdir -p -m 700 -- "$cache_dir/.zcompcache"
    zstyle ':completion:*' use-cache true
    zstyle ':completion:*' cache-path "$cache_dir/.zcompcache"

    autoload -Uz compinit
    compinit -C -d "$cache_dir/.zcompdump"
}

function _zsh_load_mamba() {
    (( $+commands[mamba] )) || return 0
    if [[ ${commands[mamba]} == /usr/bin/mamba ]]; then
        export MAMBA_ROOT_PREFIX=/usr
    else
        export MAMBA_ROOT_PREFIX=${MAMBA_ROOT_PREFIX:-$XDG_DATA_HOME/mamba}
    fi
    _zsh_source_cached mamba-hook mamba shell hook --shell zsh
}

typeset -gi ZSH_PLUGIN_LOAD_FAILED=0
function _zsh_source_plugin() {
    if [[ ! -r $1 ]]; then
        ZSH_PLUGIN_LOAD_FAILED=1
        return 1
    fi
    builtin source "$1"
}

# Zi owns downloads and updates, but ordinary startup sources installed plugin
# files directly. This avoids Zi's diff/replay bookkeeping on every shell while
# retaining an explicit, offline-by-default setup path. Readiness checks actual
# entry files rather than accepting a partial clone directory.
typeset -a _required_plugin_files=(
    "$ZDOTDIR/zi/plugins/zchee---zsh-completions/zsh-completions.plugin.zsh"
    "$ZDOTDIR/zi/plugins/srijanshetty---zsh-pandoc-completion/_pandoc"
    "$ZDOTDIR/zi/plugins/endaaman---lxd-completion-zsh/_lxc"
    "$ZDOTDIR/zi/plugins/hlissner---zsh-autopair/zsh-autopair.plugin.zsh"
    "$ZDOTDIR/zi/plugins/softmoth---zsh-vim-mode/zsh-vim-mode.plugin.zsh"
    "$ZDOTDIR/zi/plugins/Aloxaf---fzf-tab/fzf-tab.plugin.zsh"
    "$ZDOTDIR/zi/plugins/Freed-Wu---fzf-tab-source/fzf-tab-source.plugin.zsh"
    "$ZDOTDIR/zi/plugins/hchbaw---zce.zsh/zce.zsh"
    "$ZDOTDIR/zi/plugins/Aloxaf---gencomp/gencomp.zsh"
    "$ZDOTDIR/zi/plugins/wfxr---forgit/forgit.plugin.zsh"
    "$ZDOTDIR/zi/plugins/g-plane---pnpm-shell-completion/zplug.zsh"
    "$ZDOTDIR/zi/plugins/z-shell---zsh-zoxide/zsh-zoxide.plugin.zsh"
    "$ZDOTDIR/zi/plugins/MenkeTechnologies---zsh-cargo-completion/zsh-cargo-completion.plugin.zsh"
    "$ZDOTDIR/zi/plugins/bigH---git-fuzzy/bin/git-fuzzy"
    "$ZDOTDIR/zi/plugins/zsh-users---zsh-autosuggestions/zsh-autosuggestions.zsh"
    "$ZDOTDIR/zi/plugins/romkatv---powerlevel10k/powerlevel10k.zsh-theme"
    "$ZDOTDIR/zi/plugins/catppuccin---zsh-syntax-highlighting/themes/catppuccin_latte-zsh-syntax-highlighting.zsh"
    "$ZDOTDIR/zi/plugins/zsh-users---zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
)
if [[ ${THEME:-p10k} == pure ]]; then
    _required_plugin_files+=("$ZDOTDIR/zi/plugins/Aloxaf---pure/pure.zsh")
fi

typeset -a _required_snippet_files=(
    "$ZDOTDIR/zi/snippets/OMZL::clipboard.zsh/OMZL::clipboard.zsh"
    "$ZDOTDIR/zi/snippets/OMZL::git.zsh/OMZL::git.zsh"
    "$ZDOTDIR/zi/snippets/OMZP::git/git.plugin.zsh/git.plugin.zsh"
    "$ZDOTDIR/zi/snippets/OMZP::extract/OMZP::extract"
    "$ZDOTDIR/zi/snippets/OMZP::pip/OMZP::pip"
    "$ZDOTDIR/zi/snippets/OMZP::rust/_rustc/_rustc"
)
typeset -a _missing_plugins

for _plugin_file in "${_required_plugin_files[@]}" \
    "${_required_snippet_files[@]}"; do
    [[ -s $_plugin_file ]] || _missing_plugins+=("${_plugin_file:t}")
done

# Network access is confined to the explicit zsh-setup command.
if (( ${ZSH_PLUGIN_INSTALL:-0} == 1 && ${ZI_AVAILABLE:-0} )); then
    zi light-mode for \
        zchee/zsh-completions \
        srijanshetty/zsh-pandoc-completion \
        endaaman/lxd-completion-zsh \
        hlissner/zsh-autopair \
        softmoth/zsh-vim-mode \
        Aloxaf/fzf-tab \
        Freed-Wu/fzf-tab-source \
        hchbaw/zce.zsh \
        Aloxaf/gencomp \
        ver'main' wfxr/forgit \
        z-shell/zsh-zoxide \
        MenkeTechnologies/zsh-cargo-completion \
        bigH/git-fuzzy \
        zsh-users/zsh-autosuggestions \
        romkatv/powerlevel10k \
        catppuccin/zsh-syntax-highlighting \
        zsh-users/zsh-syntax-highlighting
    if [[ ${THEME:-p10k} == pure ]]; then
        zi light Aloxaf/pure
    fi
    zi ice atclone='./zplug.zsh' atpull='%atclone'
    zi light g-plane/pnpm-shell-completion
    zi snippet OMZL::clipboard.zsh
    zi snippet OMZL::git.zsh
    zi snippet OMZP::git
    zi snippet OMZP::extract
    zi snippet OMZP::pip
    zi snippet OMZP::rust/_rustc

    _zsh_compinit_once
    _zsh_load_mamba
    unfunction _zsh_compinit_once _zsh_load_mamba _zsh_source_cached
    unset _ZSH_GENERATED_CACHE_DIR
    return 0
fi

if (( ${#_missing_plugins} )); then
    print -u2 -- 'zsh: plugins are missing; startup remains offline.'
    print -u2 -- 'Run zsh-setup from an interactive terminal.'
    typeset -gi ZSH_PLUGINS_READY=0
else
    typeset -gi ZSH_PLUGINS_READY=1
fi
unset _required_plugin_files _required_snippet_files _missing_plugins \
    _plugin_file

# Completion directories enter fpath before the only compinit call.
[[ -d $ZDOTDIR/zi/plugins/zchee---zsh-completions/src/zsh ]] \
    && fpath=(
        "$ZDOTDIR/zi/plugins/zchee---zsh-completions/src/macOS"
        "$ZDOTDIR/zi/plugins/zchee---zsh-completions/src/go"
        "$ZDOTDIR/zi/plugins/zchee---zsh-completions/src/zsh"
        $fpath
    )
[[ -d $ZDOTDIR/zi/plugins/srijanshetty---zsh-pandoc-completion ]] \
    && fpath=("$ZDOTDIR/zi/plugins/srijanshetty---zsh-pandoc-completion" $fpath)
[[ -d $ZDOTDIR/zi/plugins/endaaman---lxd-completion-zsh ]] \
    && fpath=("$ZDOTDIR/zi/plugins/endaaman---lxd-completion-zsh" $fpath)
[[ -d $ZDOTDIR/zi/snippets/OMZP::rust/_rustc ]] \
    && fpath=("$ZDOTDIR/zi/snippets/OMZP::rust/_rustc" $fpath)

_zsh_compinit_once
_zsh_load_mamba
unfunction _zsh_compinit_once _zsh_load_mamba _zsh_source_cached
unset _ZSH_GENERATED_CACHE_DIR

if (( ${ZI_AVAILABLE:-0} )); then
    autoload -Uz _zi
    (( ${+_comps} )) && _comps[zi]=_zi
fi

# Editing plugins must be available before custom widgets are bound.
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/softmoth---zsh-vim-mode/zsh-vim-mode.plugin.zsh"
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/Aloxaf---fzf-tab/fzf-tab.plugin.zsh"
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/hchbaw---zce.zsh/zce.zsh"

# Local plugins kept by policy. systemd aliases intentionally remain unchanged.
_zsh_source_plugin "$ZDOTDIR/plugins/alias-tips/alias-tips.plugin.zsh"
_zsh_source_plugin "$ZDOTDIR/plugins/gentoo_alias/gentoo-alias.plugin.zsh"
_zsh_source_plugin "$ZDOTDIR/plugins/zsh-systemd/zsh-systemd.plugin.zsh"

source "$ZDOTDIR/snippets/alias.zsh"
source "$ZDOTDIR/snippets/keybinds.zsh"

# Autopair wraps the final insert-mode bindings instead of being overwritten.
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/hlissner---zsh-autopair/zsh-autopair.plugin.zsh"
# Autopair treats Ctrl-H as a one-character backspace by default. In this
# terminal mapping Ctrl-Backspace emits Ctrl-H, so retain word deletion while
# keeping Autopair's pair-aware wrapper.
if (( ${+widgets[autopair-delete-word]} )); then
    bindkey -M viins '^H' autopair-delete-word
fi

# Low-frequency integrations are deferred, and only already-installed plugins
# are registered during ordinary startup.
if (( ${ZI_AVAILABLE:-0} && ZSH_PLUGINS_READY )); then
    zi wait='0' lucid light-mode for \
        Aloxaf/gencomp \
        ver'main' wfxr/forgit

    zi wait='0' lucid light-mode for \
        atload='zpcdreplay' atclone='./zplug.zsh' atpull='%atclone' \
        g-plane/pnpm-shell-completion

    zi wait='0' lucid has'zoxide' ver'main' for \
        atload='function z() { __zoxide_z "$@" }' \
        z-shell/zsh-zoxide

    zi wait='1' lucid for \
        OMZL::clipboard.zsh \
        OMZL::git.zsh \
        OMZP::git/git.plugin.zsh \
        OMZP::extract \
        OMZP::pip \
        ver'main' MenkeTechnologies/zsh-cargo-completion

    zi ice wait='0' lucid as'program' pick'bin/git-fuzzy'
    zi load bigH/git-fuzzy

    # Preview sources load after the first prompt; the local safe fallback is
    # applied after their widgets become available.
    zi ice wait='1' lucid \
        atload="source '$ZDOTDIR/snippets/zz-fzf-tab-fix.zsh'"
    zi load Freed-Wu/fzf-tab-source
fi

_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/zsh-users---zsh-autosuggestions/zsh-autosuggestions.zsh"
