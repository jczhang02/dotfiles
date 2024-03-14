export XDG_CONFIG_HOME=$HOME/.config
export XDG_CACHE_HOME=$HOME/.cache
export XDG_DATA_HOME=$HOME/.local/share

export LANGUAGE=en_US # :zh_CN

ZDOTDIR=$XDG_CONFIG_HOME/zsh

# bun completions
[ -s "/home/jc/.bun/_bun" ] && source "/home/jc/.bun/_bun"
