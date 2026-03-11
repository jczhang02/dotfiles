# dotfiles

Personal dotfiles managed by [GNU Stow](https://www.gnu.org/software/stow/), following [this approach](https://farseerfc.me/using-gnu-stow-to-manage-your-dotfiles.html).

## Structure

Each top-level directory is a **stow package** — `stow <package>` symlinks its contents into `$HOME`.

### Desktop Environment

| Package | Description |
|---------|-------------|
| `awesome` | AwesomeWM config with modules (bling, UPower, color, collision, revelation) |
| `X11` | Xorg settings (xinitrc, xprofile, Xresources) |
| `gtk` | GTK theming |
| `Kvantum` | Qt theme engine |
| `qtct` | Qt5/6 configuration tool settings |
| `icon` | Icon theme overrides |
| `fontconfig` | Font rendering and substitution rules |
| `fcitx` | Fcitx5 input method config |
| `libinput-gestures` | Touchpad gesture mappings |

### Terminal & Shell

| Package | Description |
|---------|-------------|
| `zsh` | Zsh config — zi plugin manager, p10k theme, modular `zshrc.d/` |
| `bash` | Bash fallback config |
| `tmux` | Tmux configuration |
| `kitty` | Kitty terminal emulator |
| `bat` | Syntax-highlighted `cat` replacement |
| `eza` | Modern `ls` replacement |
| `less` | Pager config |
| `tailspin` | Log file highlighter |
| `yazi` | Terminal file manager |
| `zathura` | Vim-like PDF viewer |
| `direnv` | Per-directory environment variables |

### Editor

| Package | Description |
|---------|-------------|
| `nvim` | Neovim config (submodule, branch `0.11` of nvimdots) |

### Dev Tools

| Package | Description |
|---------|-------------|
| `git` | Git config and aliases |
| `ssh` | SSH client config with modular `config.d/` includes |
| `gnupg` | GPG + gpg-agent (with SSH agent support) |
| `go` | Go environment |
| `conda` | Conda package manager |
| `npm` | npm config |
| `pnpm` | pnpm config |
| `gem` | RubyGems config |
| `latexmk` | LaTeX build tool |
| `bin` | Custom scripts in `~/.local/bin` |

### Media & Apps

| Package | Description |
|---------|-------------|
| `mpv` | Video player with mpvDLNA plugin |
| `firefox` | Firefox user.js overrides |
| `picgo` | Image uploader |
| `aliyunpan` | Aliyun Drive CLI |

### System

| Package | Description |
|---------|-------------|
| `systemd` | User-level systemd services |
| `pipewire` | Audio server config |
| `NetworkManager` | Network dispatcher scripts |
| `containers` | Podman/container config |
| `lxc` | LXC container settings |
| `dracut` | Initramfs generator config |
| `thinkfan` | ThinkPad fan control |
| `throttled` | Intel CPU throttling fix |
| `xdg` | XDG base directory overrides |
| `btop` | System monitor |
| `eix` | Gentoo package search cache config |

### Shell Plugins (vendored)

| Package | Description |
|---------|-------------|
| `f-sy-h` | Zsh fast syntax highlighting |

## Usage

```bash
# Clone
git clone --recursive https://github.com/jczhang02/dotfiles.git ~/dev/dotfiles
cd ~/dev/dotfiles

# Deploy a package (e.g. zsh)
stow zsh

# Deploy multiple packages
stow git ssh gnupg zsh kitty tmux

# Remove a package
stow -D zsh
```

The `.stowrc` is configured with `--target=$HOME` and `--ignore=.gitmodules` by default.

## Dependencies

- [GNU Stow](https://www.gnu.org/software/stow/) — symlink farm manager
- [Zi](https://github.com/z-shell/zi) — zsh plugin manager (auto-bootstrapped)
- [AwesomeWM](https://awesomewm.org/) — tiling window manager
- [Neovim](https://neovim.io/) ≥ 0.11

## License

Personal use. Feel free to take what you need.
