# alias

function dsf() {
    diff -u $@ | delta
}

## conda alias
# alias ca="conda activate"
# alias mi="micromamba install"
# alias ms="micromamba search"
alias conda="mamba"
alias mamba="micromamba"
alias dev="cd /home/jc/dev/"

## killall gnome-terminal-server
alias kig="killall /usr/lib/gnome-terminal-server"

## docker -> podman
alias docker="podman"
# Alias settings
# source /home/jczhang/.config/zsh/snippets/dir_alias.zsh

## lock and pastebin
alias lock="i3lock-fancy-dualmonitor"
alias tb="nc termbin.com 9999"

## proxy
alias setproxy="export ALL_PROXY=http://127.0.0.1:7890"
alias unsetproxy="unset ALL_PROXY"

## program substitution
alias rm="trash"
alias ks1="kdeconnect-cli --device=6817e90ac81177dc --share"
alias ks2="kdeconnect-cli --device=4309e71d0cacb9d0 --share"
alias mutt="neomutt"
alias cat="bat"
alias vim="nvim"
alias du="dust"
alias df="duf"
alias grep="rg"
# alias ping="gping"
alias diff="dsf"
alias top="btop"

## proxychains function
function proxychains_1080() {
    proxychains -q -f ~/.config/proxychains/1080.conf $@
}
alias p1080="proxychains_1080"

## quick config edit
alias rz="source /home/jc/.config/zsh/zshrc.zsh"
alias zhe="vim /home/jc/.config/zsh/zshrc.zsh"
alias ase="vim /home/jc/.config/zsh/snippets/alias.zsh"

## filesystem
alias rd='rm -rd' md='mkdir -p'
# alias rm='rm -i --one-file-system'
alias ls='eza -bh --icons' la='ls -la' lt='ls --tree' ll='ls -l' l='ls'
alias dfh='df -h' dus='du -sh' del='gio trash' dusa='dus --apparent-size'
alias cp='cp --reflink=auto'
alias bdu='btrfs fi du' bdus='bdu -s'
alias mv='mv -v'
alias cp='cp -vr'

## gdb
alias gdb-peda='command gdb -q -ex init-peda'
alias gdb-pwndbg='command gdb -q -ex init-pwndbg'
alias gdb-gef='command gdb -q -ex init-gef'
alias gdb=gdb-pwndbg

## pacman
alias S='sudo pacman -S' Syu='sudo pacman -Syu' Rcs='sudo pacman -Rcs' RR='sudo pacman -Rs' Syyu='sudo pacman -Syyu'
alias Si='pacman -Si' Sl='pacman -Sl' Ss='noglob pacman -Ss'
alias Qi='pacman -Qi' Ql='pacman -Ql' Qs='noglob pacman -Qs'
alias Qm='pacman -Qm' Qo='pacman -Qo'
alias Fl='pacman -Fl' F='pacman -F' Fx='pacman -Fx'
alias Fy='sudo pacman -Fy'
alias U='sudo pacman -U'
alias pikaur='p pikaur'
alias Sy='sudo pacman -Sy'

alias gcc='gccm'

## git
# https://github.blog/2020-12-21-get-up-to-speed-with-partial-clone-and-shallow-clone/
alias gclt='git clone --filter=tree:0'
alias gclb='git clone --filter=blob:none'
alias gcld='git clone --depth=1'

## shanhe
alias ez_gpu_start="docker run --rm --name ez_gpu --device /dev/net/tun --cap-add NET_ADMIN -ti -e PASSWORD=xxxx -e URLWIN=1 -v $HOME/.local/share/ecdata/gpu:/root -p 127.0.0.1:5901:5901 -p 127.0.0.1:1080:1080 -p 127.0.0.1:8888:8888 hagb/docker-easyconnect:7.6.7"
alias ez_cpu_start="docker run --rm --name ez_cpu --device /dev/net/tun --cap-add NET_ADMIN -ti -e PASSWORD=xxxx -e URLWIN=1 -v $HOME/.local/share/ecdata/cpu:/root -p 127.0.0.1:5901:5901 -p 127.0.0.1:1080:1080 -p 127.0.0.1:8888:8888 hagb/docker-easyconnect:7.6.7"

## vim
alias vim="nvim"

## clash-meta
alias clash="systemctl start clash-meta@jc.service"

alias bw="BITWARDENCLI_APPDATA_DIR=~/.config/bitwarden_personal /usr/bin/bw $@"

alias tree="tree -C"
## functions

function ya() {
    local tmp="$(mktemp -t "yazi-cwd.XXXXX")"
    yazi "$@" --cwd-file="$tmp"
    if cwd="$(cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
        cd -- "$cwd"
    fi
    rm -f -- "$tmp"
}

function FileSuffix() {
    local filename="$1"
    if [ -n "$filename" ]; then
        echo "${filename##*.}"
    fi
}

function edt() {
    local filename="$1"
    if [ "$(FileSuffix ${filename})" = "tex" ]; then
        /usr/bin/texe $filename
    else
        /usr/bin/nvim $filename
    fi

}

function letd() {
    proxychains leetcode show $1 -g -l cpp
}

function lett() {
    s=$(fd $1)
    proxychains leetcode test $s
}

function lets {
    s=$(fd $1)
    proxychains leetcode submit $s

}

function gccm() {
    /usr/bin/gcc "$@" -lm

}

function Qlt() {
    pacman -Ql $1 | cut -d' ' -f2 | tree --fromfile=.
}

function compsize-package {
    sudo compsize $(pacman -Ql $1 | cut -d' ' -f2 | grep -v '/$')
}

function _pacman_packages {
    (($ + functions[_pacman_completions_installed_packages])) || {
        _pacman 2>/dev/null
    }
    _pacman_completions_installed_packages
}

## others
alias h="tldr"
alias trid="LC_ALL=C trid"
alias yafu='command rlwrap yafu'
alias rgc='rg --color=always'
alias less='less -r'
alias open='xdg-open'


# python
alias pip="pipx"
