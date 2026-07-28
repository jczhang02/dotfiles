# ==== Vim-oriented key bindings ====

bindkey -v
KEYTIMEOUT=20

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

local -A keybindings=(
    Home beginning-of-line
    End end-of-line
    Delete delete-char
    Up up-line-or-beginning-search
    Down down-line-or-beginning-search
    C-Right forward-word
    C-Left backward-word
    C-Backspace backward-kill-word
    Space magic-space
    C-a beginning-of-line
    C-e end-of-line
    C-w backward-kill-word
    C-u backward-kill-line
    C-k kill-line
    C-d delete-char
    M-q push-line-or-edit
)

for keymap in viins emacs; do
    ebindkey -M "$keymap" -A keybindings
done
ebindkey -M vicmd Backspace backward-delete-char
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

    local marker prefix token dir selected
    if [[ $LBUFFER == *'**' ]]; then
        marker='**'
    elif [[ $LBUFFER == *'*' ]]; then
        marker='*'
    else
        return 0
    fi

    prefix=${LBUFFER%$marker}
    token=${prefix##* }
    dir=${token:-.}
    dir=${dir/#\~/$HOME}
    [[ -d $dir ]] || return 0

    if [[ $marker == '**' ]]; then
        selected=$(fd -0 -H . -- "$dir" \
            | fzf --read0 --print0 --tiebreak=end,length --prompt='path> ')
    else
        selected=$(fd -0 -H -d 1 . -- "$dir" \
            | fzf --read0 --print0 --tiebreak=end,length --prompt='path> ')
    fi
    selected=${selected%$'\0'}
    [[ -n $selected ]] || return 0

    LBUFFER="${prefix%$token}${(q)selected}"
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
    TMPSUFFIX=.zsh
    edit-command-line
    unset TMPSUFFIX
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
