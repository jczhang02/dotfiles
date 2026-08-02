# ==== Shell integrations ====

(( $+commands[direnv] )) && eval "$(direnv hook zsh)"
if [[ -o interactive ]] && { : </dev/tty >/dev/tty } 2>/dev/null; then
    (( $+commands[fzf] )) && source <(fzf --zsh)
    (( $+commands[atuin] )) && eval "$(atuin init zsh --disable-up-arrow)"
fi

# 1Password generates this file after `op plugin init`.
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN
[[ -r $OP_CONFIG_DIR/plugins.sh ]] && source "$OP_CONFIG_DIR/plugins.sh"
