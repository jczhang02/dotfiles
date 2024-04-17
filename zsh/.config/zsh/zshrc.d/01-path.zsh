# ==== Path & Env ====
#  XDG_CONFIG_HOME : /etc           : ~/.config
#  XDG_CACHE_HOME  : /var/cache     : ~/.cache
#  XDG_DATA_HOME   : /usr/share     : ~/.local/share
#  XDG_RUNTIME_DIR : /tmp           : /run/user/1000
#  XDG_DATA_DIRS   :                : /usr/local/share:/usr/share
#  ZDOTDIR         :                : ~/.config/zsh

# ==== Path ====
typeset -U path PATH
typeset -U fpath FPATH

ZSHCONF="$XDG_CONFIG_HOME/zsh/zshrc.d"

path+=(
    $XDG_CONFIG_HOME/zsh/commands
    $HOME/.cargo/bin
    $XDG_DATA_HOME/npm-global/bin
    $XDG_DATA_HOME/pnpm/bin
    $XDG_DATA_HOME/gem/bin
    $XDG_DATA_HOME/gomodule/bin/
    $XDG_DATA_HOME/bin/
    $XDG_DATA_HOME/bob/nvim-bin/
)

fpath+=(
    $XDG_CONFIG_HOME/zsh/completions
    $XDG_CONFIG_HOME/zsh/functions
)

# ==== Application env ====
# EDITOR="/usr/bin/nvim"
BROWSER="/usr/bin/firefox"
TERMINFO="/usr/share/terminfo/"

# ==== Lanuage related ====

## Rust mirror
RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup

## Go
export GOPATH="/home/jc/.local/share/gomodule"

## Python
# IPYTHONDIR=$XDG_CONFIG_HOME/ipython
JUPYTER_CONFIG_DIR=$XDG_CONFIG_HOME/jupyter

## Nodejs
NPM_CONFIG_USERCONFIG=$XDG_CONFIG_HOME/npm/config

# ==== Module ====
## ssh_auth via gpg-agent
# SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)

## better python expression
FORCE_COLOR=1

## LS_COLORS
LS_COLORS="$(vivid generate ayu)"

## fzf/fd default opt
SPROMPT="%B%F{yellow}zsh: correct '%R' be '%r' [nyae]?%f%b "
FZF_CTRL_T_OPTS="--preview '(highlight -O ansi -l {} 2> /dev/null || cat {} || tree -C {}) 2> /dev/null | head -200'"
FZF_DEFAULT_COMMAND='fd --type f --hidden --follow'

## Aliyunpan
export ALIYUNPAN_CONFIG_DIR="/home/jc/.config/aliyunpan"

## Starship
# export STARSHIP_CONFIG="/home/jc/.config/starship/starship.toml"
