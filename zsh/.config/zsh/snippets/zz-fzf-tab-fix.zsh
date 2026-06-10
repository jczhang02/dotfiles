# 覆盖 fzf-tab-source 的 --complete.zsh 全局 fallback.
# 上游脚本跑裸 `less ${realpath#-*=}`, less 默认交互式分页, 在 fzf preview
# 内锁 tty, 整个补全 hang. 典型触发: `xdg-open <Tab>` (2026-05-19 复现).
# 此文件必须在 fzf-tab-source 之后 source. 04-plugin.zsh 的 snippets loop
# 排在 zi light-mode plugin 加载之后, 文件名以 zz- 开头保证字典序最末.
zstyle ':fzf-tab:complete:*' fzf-preview '
    local target=${realpath#-*=}
    [[ -z $target ]] && return
    if [[ -d $target ]]; then
        eza -1 --color=always "$target" 2>/dev/null
    elif [[ -f $target ]]; then
        bat --color=always --paging=never --style=plain "$target" 2>/dev/null \
            || head -c 4096 "$target" 2>/dev/null
    fi
'
