# :fzf-tab:complete:mamba:*
python --version | bat

RED="\033[1;31m"
GREEN="\033[1;32m"
NOCOLOR="\033[0m"

list=$(conda list -n $word)
result=$(echo $list | grep torch)

if [[ "$result" != "" ]]
then
    echo -e "${GREEN}Torch${NOCOLOR}" | bat
else
    echo -e "${RED}!Torch${NOCOLOR}" | bat
fi
