# ==== Module ====
## mamba
eval "$(micromamba shell hook --shell zsh)"

export MAMBA_EXE="/home/jc/.local/bin/micromamba";
export MAMBA_ROOT_PREFIX="/home/jc/.conda";

__mamba_setup="$('/home/jc/.local/bin/micromamba' shell hook --shell zsh --prefix '/home/jc/.conda' 2> /dev/null)"

eval "$__mamba_setup"


zmodload zsh/zprof

# thefuck
eval $(thefuck --alias)

# broot
source $XDG_CONFIG_HOME/broot/launcher/bash/br
