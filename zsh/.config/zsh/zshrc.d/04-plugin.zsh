# ==== Plugin ===

zi wait="0" lucid light-mode for \
    hlissner/zsh-autopair \
    hchbaw/zce.zsh \
    Aloxaf/gencomp \
    Aloxaf/zsh-sqlite \
    wfxr/forgit \
    lukechilds/zsh-nvm

zi light-mode for \
    as="program" atclone="rm -f ^(rgg|agv)" \
    lilydjwg/search-and-view \
    src="etc/git-extras-completion.zsh" \
    tj/git-extras \
    atload="zpcdreplay" atclone="./zplug.zsh" atpull='%atclone' \
    g-plane/pnpm-shell-completion

zi has'zoxide' ver'auto_pushd' for atload="function z() { __zoxide_z \"\$@\" }" \
    z-shell/zsh-zoxide

zi wait="1" lucid for \
    OMZL::clipboard.zsh \
    OMZL::git.zsh \
    OMZP::git/git.plugin.zsh \
    OMZP::extract \
    OMZP::pip

zi ice as"program" pick"bin/git-fuzzy"
zi light bigH/git-fuzzy

zi ice as"completion"
zi light-mode for \
    zchee/zsh-completions \
    srijanshetty/zsh-pandoc-completion  \
    conda-incubator/conda-zsh-completion \
    endaaman/lxd-completion-zsh

zi ice as"completion" blockf
zi snippet https://github.com/ohmyzsh/ohmyzsh/blob/master/plugins/rust/_rustc


zi light-mode for \
    softmoth/zsh-vim-mode \
    twang817/zsh-manydots-magic

zi light Aloxaf/fzf-tab
zi light Freed-Wu/fzf-tab-source

zpcompinit; zpcdreplay

for i in $XDG_CONFIG_HOME/zsh/plugins/*/*.plugin.zsh; do
    source $i
done

for i in $XDG_CONFIG_HOME/zsh/snippets/*.zsh; do
    source $i
done

zi ice wait lucid atinit"ZI[COMPINIT_OPTS]=-C; zpcompinit; zpcdreplay"
zi light z-shell/F-Sy-H
zi ice wait lucid atload"!_zsh_autosuggest_start"
zi load zsh-users/zsh-autosuggestions

command="Generate a concise git commit message that summarizes the key changes. Stay high-level and combine smaller changes to overarching topics. Skip describing any reformatting changes."

alias autocommit="BRANCH_NAME=\$(git branch --show-current) && MSG=\"\$(git diff --staged | sgpt '$command')\" && PREFIXED_MSG=\"\${BRANCH_NAME}: \${MSG}\" && echo \${PREFIXED_MSG} && git commit"
