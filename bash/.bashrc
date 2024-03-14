########################################################################
##
## yano's .bashrc
##
########################################################################

########################################
## general settings
########################################

umask 002

# if not running interactively, don't do anything
[ -z "$PS1" ] && return

# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi

# don't put duplicate lines in the history. See bash(1) for more options
# don't overwrite GNU Midnight Commander's setting of `ignorespace'.
export HISTCONTROL=$HISTCONTROL${HISTCONTROL+,}ignoredups
# ... or force ignoredups and ignorespace
export HISTCONTROL=ignoreboth

# append to the history file, don't overwrite it
shopt -s histappend

# ignore simple, repetitive commands
export HISTIGNORE="&:ls:ll:la:cd:exit:clear"

# enable bash_completion if available
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
fi

# enable programmable completion features
if [ -f /etc/bash_completion ] && ! shopt -oq posix; then
    . /etc/bash_completion
fi

########################################
## environmental variables
########################################

# set VIM as my default text editor
export EDITOR='nvim'

# set bash as shell
export SHELL=/bin/bash

# ensures programs know to use 256-colours
if [[ $TERM == "xterm" ]]; then
    export TERM="xterm-256color"
elif [[ $TERM == "screen" ]]; then
    export TERM="screen-256color"
fi

# Provide a kickass prompt
PS1='\[\033[0;36m\]$(date "+%H:%M") \[\033[01;32m\][\[\033[01;31m\]\w\[\033[01;32m\]]\n\[\033[01;31m\](\[\033[01;32m\]\u@\h\[\033[01;31m\]) #\[\033[00m\] '

# set variable identifying the chroot you work in (used in the prompt below)
if [ -z "$debian_chroot" ] && [ -r /etc/debian_chroot ]; then
    debian_chroot=$(cat /etc/debian_chroot)
fi

# force colour prompt
if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
        # We have color support; assume it's compliant with Ecma-48
        # (ISO/IEC-6429). (Lack of such support is extremely rare, and such
        # a case would tend to support setf rather than setaf.)
        color_prompt=yes
    else
        color_prompt=
    fi
fi

# enable sudo completion
complete -cf sudo

########################################
## aliases
########################################

# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias dir='dir --color=auto'
    alias vdir='vdir --color=auto'
    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

alias ls='ls --color=auto -h'
alias ll='ls -la'
alias la='ls -a'
alias l='ls -CF'
alias vim="nvim"
