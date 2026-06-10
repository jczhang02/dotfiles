# tmux session auto-rename disabled.
#
# Historical behavior:
#   - chpwd/precmd renamed tmux session to git repo/worktree name.
#   - this made session names drift when entering repos.
#
# Current policy:
#   - session names are user/sesh-owned and must not auto-change.
#   - window names are handled by tmux-autoname instead.
#
# If an existing zsh already loaded old hooks, run inside that shell:
#   autoload -Uz add-zsh-hook
#   add-zsh-hook -d chpwd _tmux_smart_rename
#   add-zsh-hook -d precmd _tmux_smart_rename
#   add-zsh-hook -d preexec _tmux_refresh_window_name
