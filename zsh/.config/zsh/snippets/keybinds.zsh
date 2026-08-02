# ==== Vim-oriented key bindings ====

bindkey -v
KEYTIMEOUT=20
zmodload zsh/terminfo 2>/dev/null

# Keep terminal navigation keys in application mode without replacing other
# plugins' zle-line-init/zle-line-finish widgets.
if (( ${+terminfo[smkx]} && ${+terminfo[rmkx]} )); then
    function _terminal_keypad_start() {
        echoti smkx
    }
    function _terminal_keypad_stop() {
        echoti rmkx
    }
    autoload -Uz add-zle-hook-widget
    add-zle-hook-widget line-init _terminal_keypad_start
    add-zle-hook-widget line-finish _terminal_keypad_stop
fi

autoload -Uz up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search

() {
    local keymap
    local -A key=(
        Home "${terminfo[khome]:-$'\e[H'}"
        End "${terminfo[kend]:-$'\e[F'}"
        Delete "${terminfo[kdch1]:-$'\e[3~'}"
        Up "${terminfo[kcuu1]:-$'\e[A'}"
        Down "${terminfo[kcud1]:-$'\e[B'}"
    )

    for keymap in viins emacs; do
        bindkey -M "$keymap" "$key[Home]" beginning-of-line
        bindkey -M "$keymap" "$key[End]" end-of-line
        bindkey -M "$keymap" "$key[Delete]" delete-char
        bindkey -M "$keymap" "$key[Up]" up-line-or-beginning-search
        bindkey -M "$keymap" "$key[Down]" down-line-or-beginning-search
        bindkey -M "$keymap" '^[[1;5C' forward-word
        bindkey -M "$keymap" '^[[1;5D' backward-word
        bindkey -M "$keymap" '^H' backward-kill-word
        bindkey -M "$keymap" ' ' magic-space
        bindkey -M "$keymap" '^A' beginning-of-line
        bindkey -M "$keymap" '^E' end-of-line
        bindkey -M "$keymap" '^W' backward-kill-word
        bindkey -M "$keymap" '^U' backward-kill-line
        bindkey -M "$keymap" '^K' kill-line
        bindkey -M "$keymap" '^D' delete-char
        bindkey -M "$keymap" '^[q' push-line-or-edit
    done
}
bindkey -M vicmd '^?' backward-delete-char
bindkey -M viins 'jk' vi-cmd-mode

# Atuin owns Ctrl-R; Up/Down stay with native prefix history search.
if (( ${+widgets[atuin-search]} )); then
    bindkey -M emacs '^R' atuin-search
fi
if (( ${+widgets[atuin-search-viins]} )); then
    bindkey -M viins '^R' atuin-search-viins
fi
if (( ${+widgets[atuin-search-vicmd]} )); then
    bindkey -M vicmd '^R' atuin-search-vicmd
fi
bindkey -M vicmd '/' history-incremental-search-backward

# Replace a trailing * or ** with an interactively selected path. Parameter
# expansion is deliberately limited to a leading ~; no shell input is eval'd.
function fz-find() {
    emulate -L zsh

    local marker prefix token leading dir raw_selection selected
    local -a selected_paths
    if [[ $LBUFFER == *'**' ]]; then
        marker='**'
        prefix=${LBUFFER[1,-3]}
    elif [[ $LBUFFER == *'*' ]]; then
        marker='*'
        prefix=${LBUFFER[1,-2]}
    else
        return 0
    fi

    token=${prefix##* }
    leading=${prefix[1,$(( ${#prefix} - ${#token} ))]}
    dir=${token:-.}
    dir=${dir/#\~/$HOME}
    [[ -d $dir ]] || return 0

    if [[ $marker == '**' ]]; then
        raw_selection=$(fd -0 -H . -- "$dir" \
            | fzf --read0 --print0 --tiebreak=end,length --prompt='path> ')
    else
        raw_selection=$(fd -0 -H -d 1 . -- "$dir" \
            | fzf --read0 --print0 --tiebreak=end,length --prompt='path> ')
    fi
    selected_paths=("${(@0)raw_selection}")
    selected=${selected_paths[1]:-}
    [[ -n $selected ]] || return 0

    LBUFFER="${leading}${(q)selected}"
    zle end-of-line
}
zle -N fz-find
bindkey -M viins '^[s' fz-find
bindkey -M emacs '^[s' fz-find

function zce-jump-char() {
    [[ -z $BUFFER ]] && zle up-history
    zstyle ':zce:*' keys 'asdghklqwertyuiopzxcvbnmfj;23456789'
    zstyle ':zce:*' prompt-char '%B%F{green}Jump to character:%F%b '
    zstyle ':zce:*' prompt-key '%B%F{green}Target key:%F%b '
    with-zce zce-raw zce-searchin-read
    (( CURSOR += 1 ))
}
zle -N zce-jump-char
bindkey -M viins '^[j' zce-jump-char
bindkey -M emacs '^[j' zce-jump-char

function rationalise-dot() {
    if [[ $LBUFFER == *.. ]]; then
        LBUFFER+=/..
    else
        LBUFFER+=.
    fi
}
zle -N rationalise-dot
bindkey -M viins . rationalise-dot
bindkey -M emacs . rationalise-dot

autoload -Uz edit-command-line
function edit-command-line-as-zsh() {
    local TMPSUFFIX=.zsh
    edit-command-line
}
zle -N edit-command-line-as-zsh
bindkey -M viins '^X^E' edit-command-line-as-zsh
bindkey -M emacs '^X^E' edit-command-line-as-zsh

function execute-command() {
    local selected
    selected=$(printf '%s\n' ${(k)widgets} | fzf --reverse --prompt='widget> ' --height=10)
    zle redisplay
    [[ -n $selected ]] && zle "$selected"
}
zle -N execute-command
bindkey -M viins '^[x' execute-command
bindkey -M emacs '^[x' execute-command
