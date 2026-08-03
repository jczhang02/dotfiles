# MPV 配置研究与处理建议

> 调查日期：2026-08-03
>
> 实施状态：已按本文结论删除旧 package，部署并验证原生单文件配置。

## 结论

本轮已经删除仓库里原有的整套 `mpv/` 配置，以及 `.gitmodules` 中的 `mpvDLNA` stanza，并用一个只依赖 mpv 原生功能的极简配置替代。

不推荐继续更新现有第三方配置包，也不推荐换成另一套大型配置包。原因不是它们都停止维护，而是当前机器已经同时存在两套互不相关的第三方配置，实际生效的又是第三套状态；脚本、字体、shader 和嵌套 Git 仓库已经超过实际需求，并且产生了可复现的启动错误。

建议的新配置不加载任何自定义脚本，不保留 `input.conf`，直接使用 mpv 0.41 的内置 OSC、右键菜单和默认键位。官方示例明确说明 mpv 没有一份需要完整复制的“默认配置”，只应写入确实要改变的选项；默认键位已经编译进 mpv。[官方 `mpv.conf` 示例](https://github.com/mpv-player/mpv/blob/master/etc/mpv.conf)，[官方默认键位](https://github.com/mpv-player/mpv/blob/master/etc/input.conf)

## 1. 仓库中的 MPV 配置是什么

`mpv/.config/mpv` 有 159 个文件，约 20 MiB。根据文件内容、版权、配置和脚本的 Git blob 对比，它来自 [Hill-98/mpv-config](https://github.com/Hill-98/mpv-config)。仓库里的 `.commit_time` 对应 2023-12-25，本地 `linux.conf`、`input.conf` 和多个脚本也与该时期的上游内容一致。

这个上游没有消失，也没有停止维护；调查时最新提交是 2026-08-02 的 [`9a90be6`](https://github.com/Hill-98/mpv-config/commit/9a90be6ce13411bc8d5e7498c84cc1584ad99402)。但它是一整套配置发行包，当前源码还依赖 10 个 Git submodule，并通过安装脚本或 GitHub Actions 生成最终配置。把其中一次生成结果复制进 dotfiles，会失去可靠的更新边界。

仓库快照与本机 mpv 0.41.0 的实测结果包括：

- `sub-ass-vsfilter-blur-compat` 已被移除，启动时配置解析失败；当前选项是 `sub-ass-use-video-data`，默认已经是官方推荐的 `all`。[mpv 字幕选项](https://mpv.io/manual/stable/#options-sub-ass-use-video-data)
- `best-display-fps` 在 Linux 上明确报告只支持 Windows。
- `no-deband` 自动 profile 在没有视频属性时计算失败。
- `mpvDLNA` 每次启动都会因 Python 依赖缺失而加载失败。

因此，直接把这份 2023 快照继续 Stow 到新机器并不可靠。

## 2. `mpvDLNA` 的真实状态

`.gitmodules` 里的 `mpvDLNA` 记录无论上游是否维护，都应该删除：当前 Git index 中该路径下是 9 个普通文件，没有 mode `160000` 的 gitlink。历史显示它在 2024-03-14 已经从 submodule 转成普通文件，但 `.gitmodules` 没有同步更新。

[chachmu/mpvDLNA](https://github.com/chachmu/mpvDLNA) 仍然存在、没有 archived。最后代码提交和最新版本 [`v3.4.1`](https://github.com/chachmu/mpvDLNA/releases/tag/v3.4.1) 都是 2024-04-10。到 2026-08-03 已超过两年没有代码更新，因此可以称为“长期静止”，但不能断言仓库已经不存在。

本地副本不值得保留：

- `main.js` 自报版本为 `3.3.1`，比上游 `3.4.1` 旧。
- `input.conf` 没有绑定它提供的三个入口，正常使用时无法打开其界面。
- 它依赖 Python 的 `upnpclient` 和 `lxml`；当前 Python 环境没有 `upnpclient`。
- mpv 会自动加载 `~/.config/mpv/scripts/` 下的全部脚本，所以即使从不使用 DLNA，它也会在每次启动时执行并报错。[mpv 文件与脚本加载规则](https://mpv.io/manual/stable/#files)

精确建议：删除 `mpvDLNA` 文件和 `.gitmodules` stanza，不寻找替代 DLNA 插件。只有在明确需要浏览家庭 DLNA 媒体库时，才单独重新评估这个功能。

## 3. 实施前真正生效的配置

实施前，`~/.config/mpv` 不是 dotfiles 的链接，而是独立 Git 仓库：

- 上游是 [noelsimbolon/mpv-config](https://github.com/noelsimbolon/mpv-config)。
- 当前 checkout 是 `windows` 分支的 2025-05-08 提交，并有本地 `mpv.conf` 修改。
- 上游默认分支实际是 `linux`；该分支调查时最新提交为 2026-04-30 的 [`414c926`](https://github.com/noelsimbolon/mpv-config/commit/414c926137f8ac981a938f91e9828dff1c8e1001)。
- 目录约 16 MiB，包含 12 个 Lua 脚本、OSC、字体、shader、shader cache 和自身的 `.git`。

这解释了为什么仓库里的 `mpvDLNA` 错误平时可能没有出现：仓库中的 `mpv/` package 根本没有部署。它也意味着在部署新配置前，必须先安全备份或移走当前 `~/.config/mpv`，否则 Stow 会发生冲突。

更新到 noelsimbolon 的 Linux 分支是可行备选，但仍会继续引入大量第三方 Lua、字体和 shader；它也在无媒体输入的诊断中触发 `WEB-DL` profile 条件错误。考虑到目标是少维护、少自己实现，原生极简配置更合适。

## 4. 推荐的新配置

建议新的 `mpv/.config/mpv/mpv.conf` 只包含：

```conf
profile=high-quality
vo=gpu-next
gpu-api=opengl
hwdec=auto

save-position-on-quit=yes

alang=zh,zho,chi,ja,jpn,en,eng
slang=zh,zho,chi,ja,jpn,en,eng
sub-auto=fuzzy
audio-file-auto=fuzzy

screenshot-format=png
```

本轮已经按上述内容部署，没有增加 `input.conf`、脚本、字体或 shader。

选择依据：

- `gpu-next` 是 mpv 当前推荐的视频输出；虽然目前也是默认值，但官方说明默认值可能变化，因此这里显式固定。[mpv 视频输出文档](https://mpv.io/manual/stable/#video-output-drivers)
- `high-quality` 是 mpv 自带 profile，用它替代 Anime4K、ACNet、FSRCNNX 和管理这些 shader 的自定义脚本。[mpv 官方示例配置](https://github.com/mpv-player/mpv/blob/master/etc/mpv.conf)
- `hwdec=auto` 是官方建议首先尝试的硬件解码模式。[mpv 硬件解码文档](https://mpv.io/manual/stable/#options-hwdec)
- 本机是 Intel Iris Xe、Wayland、i915。实测 `gpu-api=auto` 和 `vulkan` 会先尝试不受设备支持的 Vulkan Video，并输出 `VK_KHR_video_decode_queue` 错误，再回退 VAAPI；显式 `opengl` 可直接使用 VAAPI，播放无警告。
- `save-position-on-quit` 保留原仓库希望的自动续播；mpv 会将状态写到 XDG state 目录。[mpv Watch Later 文档](https://mpv.io/manual/stable/#watch-later)
- 语言、外部字幕/音轨匹配和 PNG 截图是从旧配置中保留的少数用户层偏好。
- 不设置 `osc=no` 或 `input-builtin-bindings=no`，因此直接恢复官方内置 UI 和键位。

本机用一个两秒 H.264 样本验证过这组参数：

```text
Using hardware decoding (vaapi).
VO: [gpu-next] 1280x720 vaapi[nv12]
```

## 5. 不推荐的替代方案

### 继续采用 Hill-98/mpv-config

上游活跃，但它是面向多平台的完整发行包，包括 10 个 submodule、自有更新检查、多个脚本和大量 shader。它解决的问题明显多于当前需要解决的问题，并不符合本次减少自维护面的目标。

### 采用 noelsimbolon/mpv-config 的 Linux 分支

它比当前生效的 Windows 分支更合理，也仍在更新，但依然需要跟踪一组第三方脚本、字体和 shader。只有在用户明确要求 ModernZ、SponsorBlock、GIF、缩略图或 playlist manager 等功能时才值得采用。

### 单独安装 uosc

[uosc](https://github.com/tomasklaen/uosc) 仍在维护，最新正式版是 [`5.12.0`](https://github.com/tomasklaen/uosc/releases/tag/5.12.0)，但其 release archive 约 7.8 MiB，解压后还包含三个平台的辅助二进制。mpv 0.41 自带 OSC 和上下文菜单已经足够，当前没有证据表明必须引入它。

## 6. 实施与验证

旧的仓库 package 和原 `~/.config/mpv` 独立 Git 仓库均已移到回收站。新配置通过 GNU Stow 的 `--no-folding` 部署为 `~/.config/mpv/mpv.conf`。

以下命令可在仓库根目录复现检查。

先确认新 package 不再包含第三方脚本、shader 或失效的 submodule 记录：

```sh
find mpv -type f -print
rg -n 'mpvDLNA' .gitmodules mpv README.md
```

预期：`mpv` 只包含 `mpv.conf`，其他三个目标中没有 `mpvDLNA`。

部署前检查冲突：

```sh
stow --no-folding --simulate --verbose=2 mpv
```

当前目标已经是指向 dotfiles 的单文件链接，不再存在 Stow 冲突。

生成短测试视频并验证配置、渲染器和硬件解码：

```sh
mpv_test_dir=$(mktemp -d)
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -t 2 -c:v libx264 -pix_fmt yuv420p \
  "$mpv_test_dir/sample.mp4"

mpv --config-dir="$PWD/mpv/.config/mpv" \
  --ao=null --keep-open=no --fullscreen=no \
  --msg-level=all=warn "$mpv_test_dir/sample.mp4"

mpv --config-dir="$PWD/mpv/.config/mpv" \
  --ao=null --keep-open=no --fullscreen=no \
  --msg-level=vd=debug "$mpv_test_dir/sample.mp4" 2>&1 \
  | rg 'Using hardware decoding|VO:'
```

预期第一条 mpv 命令退出码为 0 且没有警告；第二条应显示 VAAPI hardware decoding 和 `gpu-next`。

本轮两秒 H.264 实播的退出码为 0，没有配置警告，并确认：

```text
Using hardware decoding (vaapi).
```

最后仍应在日常使用中检查内置 OSC、默认键位、中文字幕优先级、截图和退出续播。测试完成后再运行一次：

```sh
git status --short
```

确认播放没有把 cache 或运行时文件写入 dotfiles。
