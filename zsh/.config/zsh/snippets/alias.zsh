# ==== Aliases and small interactive helpers ====

function dsf() {
    command diff -u "$@" | delta
}

function gccm() {
    command gcc "$@" -lm
}

function rz() {
    exec zsh
}

function zhe() {
    nvim "$ZDOTDIR/zshrc.zsh"
}

function ase() {
    nvim "$ZDOTDIR/snippets/alias.zsh"
}

function yy() {
    local tmp cwd status

    tmp=$(mktemp -t yazi-cwd.XXXXXX) || return
    yazi "$@" --cwd-file="$tmp"
    status=$?
    cwd=$(command cat -- "$tmp" 2>/dev/null)
    command rm -f -- "$tmp"

    if [[ -n $cwd && $cwd != $PWD ]]; then
        builtin cd -- "$cwd"
    fi
    return $status
}

# Intentional interactive substitutions.
alias docker='podman'
alias rm='trash'
alias vim='nvim'
alias conda='mamba'

# Filesystem convenience without replacing cat/du/df/top semantics.
alias md='mkdir -p'
alias ls='eza -bh --icons'
alias la='ls -la'
alias lt='ls --tree'
alias ll='ls -l'
alias l='ls'
alias dfh='df -h'
alias dus='du -sh'
alias dusa='dus --apparent-size'
alias del='gio trash'
alias cp='cp --reflink=auto'
alias bdu='btrfs fi du'
alias bdus='bdu -s'
alias tree='tree -C'

# Partial and shallow clones talk only to the supplied Git remote.
alias gclt='git clone --filter=tree:0'
alias gclb='git clone --filter=blob:none'
alias gcld='git clone --depth=1'

alias h='tldr'
alias rgc='rg --color=always'
alias less='less -r'
alias open='xdg-open'
