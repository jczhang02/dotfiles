# ==== Module ====

# direnv
eval "$(direnv hook zsh)"



# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/usr/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/usr/etc/profile.d/conda.sh" ]; then
        . "/usr/etc/profile.d/conda.sh"
    else
        export PATH="/usr/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<


# micromamba
# eval "$(micromamba shell hook --shell zsh)"

# export MAMBA_EXE="/usr/bin/micromamba";
# export MAMBA_ROOT_PREFIX="/home/jc/.conda";

# __mamba_setup="$('micromamba' shell hook --shell zsh --prefix '/home/jc/.conda' 2> /dev/null)"

# eval "$__mamba_setup"

# mamba
eval "$(mamba shell hook --shell zsh)"


zmodload zsh/zprof

# thefuck
eval $(thefuck --alias)

# broot
source $XDG_CONFIG_HOME/broot/launcher/bash/br
