# ==== Prompt and syntax highlighting ====

if (( ${ZSH_PLUGIN_INSTALL:-0} == 1 )); then
    (( $+functions[_zsh_source_plugin] )) && unfunction _zsh_source_plugin
    return 0
fi

: ${THEME:=p10k}

case $THEME in
    pure)
        PROMPT=$'\n%F{cyan}❯ %f'
        RPROMPT=''
        zstyle ':prompt:pure:prompt:success' color cyan
        _zsh_source_plugin \
            "$ZDOTDIR/zi/plugins/Aloxaf---pure/pure.zsh"
        ;;
    p10k)
        source "$ZDOTDIR/p10k.zsh"
        _zsh_source_plugin \
            "$ZDOTDIR/zi/plugins/romkatv---powerlevel10k/powerlevel10k.zsh-theme"
        ;;
esac

# Theme data is loaded before zsh-syntax-highlighting, which remains the final
# plugin to install ZLE hooks.
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/catppuccin---zsh-syntax-highlighting/themes/catppuccin_latte-zsh-syntax-highlighting.zsh"
_zsh_source_plugin \
    "$ZDOTDIR/zi/plugins/zsh-users---zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"

# Convert entry-file readiness into a runtime guarantee for the core editing
# path. A second offline shell in zsh-setup relies on this flag.
if [[ $THEME == p10k ]] && (( ! $+functions[p10k] )); then
    ZSH_PLUGIN_LOAD_FAILED=1
fi
for _required_widget in vi-cmd-mode fzf-tab-complete autopair-insert; do
    (( ${+widgets[$_required_widget]} )) || ZSH_PLUGIN_LOAD_FAILED=1
done
(( $+functions[_zsh_autosuggest_start] )) || ZSH_PLUGIN_LOAD_FAILED=1
(( $+functions[_zsh_highlight] )) || ZSH_PLUGIN_LOAD_FAILED=1
(( ZSH_PLUGIN_LOAD_FAILED )) && ZSH_PLUGINS_READY=0

unset ZSH_PLUGIN_LOAD_FAILED _required_widget
unfunction _zsh_source_plugin
