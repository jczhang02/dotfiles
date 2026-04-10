# ==== theme ====

zinit light-mode for \
    atload="source $XDG_CONFIG_HOME/zsh/zi/plugins/catppuccin---zsh-syntax-highlighting/themes/catppuccin_latte-zsh-syntax-highlighting.zsh" \
    zsh-users/zsh-syntax-highlighting


: ${THEME:=p10k}

case $THEME in
    pure)
        PROMPT=$'\n%F{cyan}❯ %f'
        RPROMPT=""
        zstyle ':prompt:pure:prompt:success' color cyan
        zinit ice lucid wait="!0" pick="async.zsh" src="pure.zsh" atload="prompt_pure_precmd"
        zinit light Aloxaf/pure
        ;;
    p10k)
        source $XDG_CONFIG_HOME/zsh/p10k.zsh
        zinit ice depth=1
        zinit light romkatv/powerlevel10k
        ;;
esac
