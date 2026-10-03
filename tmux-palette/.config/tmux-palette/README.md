# tmux-palette 本机配置

按 Alt+P 打开；JSON 配置在每次打开时读取，无需重新加载 tmux。

- `theme.json` 选择 `themes/catppuccin-latte.json`；该主题也会出现在主题选择器中。
- `Autoname Auto` 对当前窗口执行 `tmux-autoname auto`: 手动改名后恢复自动命名 (等同 `rename-window ""`). tmux-autoname 0.7.0 已移除 AI 命名, `refresh`/`explain`/`secrets reload` 不再存在, 对应条目已删除.
- `Dictionary (kd)` 打开 `kd-popup` (dotfiles `kd` 包): 输入即查, 4 个及以上单词或前缀 `-t` 按长句翻译; Enter 存入历史, 上下键调出, Esc 直接回到原 pane. 在面板输入 `kd <word>` 回车直接查该词并自动存入历史 (查不到的词和翻译失败的句子不存). `kd <word>` 依赖本地插件补丁 (见下). 该条用 `shell` action 调用 `tmux-popup-anim` (dotfiles `tmux` 包; 弹窗前后各 4 帧缩放外框, `TMUX_POPUP_ANIM=0` 关闭): `popup` action 关闭后插件会重新打开面板.
- `Windows` 分组补充窗口操作: Move Window to... (放到指定编号, 已占用时其余窗口顺移并重新编号), Swap Window with... / Left / Right (交换后焦点跟随), Renumber Windows (`move-window -r`), Move Window to Session..., Choose Window.
- `hidden.json` 隐藏内置 `Reload Config` (指向不存在的 `~/.tmux.conf`, 保留的 `Reload tmux Config` 使用 XDG 路径), 以及已有快捷键的导航项: Next/Previous Pane/Window/Session, Last Window, Swap Pane Up/Down, Display Pane Numbers, Cycle Pane Layout.

## 命令配置注意事项

- tmux popup 不设置 `TMUX_PANE`, 也不展开 shell 命令中的 tmux 格式; 需要当前窗口时用 `tmux` action 的 `run-shell`, 它会展开 `#{window_id}`.
- 当前插件直接把 `action.popup` 拼入 shell 命令。包含管道或分号时，需要把整个命令包在单引号中，例如 `"popup": "'df -h | less -S'"`，使管道在弹窗内部执行。
- GitHub PRs 保持原配置. Find Files, Git Branches, Disk Usage, Listening Ports, Toggle Mouse 已删除 (分别由 yazi/fzf, Lazygit 等替代).
- 条目可设 `width`/`height` 覆盖弹窗尺寸 (默认 80%).
- popup 命令由 zsh `-c` 执行, 只用 POSIX 语法 (例如不用 bash 的 `read -p`).

插件来自 fork `jczhang02/tmux-palette` (`@plugin` 见 `tmux.conf.local`), 在 upstream main 之上带两个补丁:

- `feat: keyword items bind trailing query text to {query}`: 条目设 `keyword` 后, 输入 `<keyword> <文本>` 只显示该条, 并把 shell 引号包裹的文本代入 action 中的 `{query}`.
- `fix: accept multi-character text input and place the cursor by display width`: 输入法一次提交多个汉字或粘贴时整段插入; 光标按显示宽度定位, 预编辑框位置正确.

fork 的 `Sync upstream` workflow 每天把 upstream main merge 进来, 测试通过才推送; 冲突或测试失败时 GitHub 发邮件, 需手动合并. TPM 更新 (`prefix U`) 从 fork 拉取. 注意 GitHub 会在仓库 60 天无活动后停用定时 workflow, 届时在 Actions 页面重新启用.

本目录由 dotfiles 的 `tmux-palette` 包 stow 部署; 只有主题选择器会改写的 `theme.json` 留在本地. 修改配置请编辑 dotfiles 仓库内的文件.
