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
| `mise` | User-level CLI tool versions and installation policy |
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

### Shell Themes

| Package | Description |
|---------|-------------|
| `f-sy-h` | Catppuccin themes for F-Sy-H |

## Usage

```bash
# Clone
git clone --recursive https://github.com/jczhang02/dotfiles.git ~/dev/dotfiles
cd ~/dev/dotfiles

# Deploy Zsh with its mise and F-Sy-H configuration
stow zsh mise f-sy-h

# Deploy multiple packages
stow git ssh gnupg zsh mise f-sy-h kitty tmux

# Install Zi after deploying the Zsh package
git clone --depth=1 https://github.com/z-shell/zi.git \
  "${XDG_DATA_HOME:-$HOME/.local/share}/zi/bin"

# Remove a package
stow -D zsh
```

Close terminals using the old configuration, then preserve history and zoxide
jump data with a one-time copy:

```bash
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/zsh"
install -d -m 700 "$state_dir"
cp --no-clobber "$HOME/.config/zsh/.zsh_history" "$state_dir/history"
chmod 600 "$state_dir/history"

data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
install -d -m 700 "$data_dir/zoxide"
cp --no-clobber "$HOME/.config/zsh/zi/polaris/share/db.zo" \
  "$data_dir/zoxide/db.zo"
```

The `cargo:gig-cli` mise entry is built from the unpublished local checkout.
Recreate its linked installation before running `mise install` on a new machine:

```bash
mise_data_dir="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}"
cargo install --path "$HOME/dev/gig/crates/gig-cli" \
  --root "$mise_data_dir/linked/gig-cli/0.1.0"
mise link cargo:gig-cli@0.1.0 \
  "$mise_data_dir/linked/gig-cli/0.1.0"
```

The packaged mise 2026.7.5 does not create shims for linked versions even
after `mise reshim`. Interactive activation still exposes `gig`; shim-only
consumers should use `mise exec -- gig ...` until a mise upgrade fixes this, or
until the project has a remote that the Cargo Git backend can install. Do not
create a shim by hand because `mise reshim` owns that directory.

The `.stowrc` is configured with `--target=$HOME` and `--ignore=.gitmodules` by default.

## Dependencies

- [GNU Stow](https://www.gnu.org/software/stow/) — symlink farm manager
- [mise](https://mise.jdx.dev/) — user-level CLI tool manager
- [Zi](https://github.com/z-shell/zi) — Zsh plugin manager (installed separately)
- [AwesomeWM](https://awesomewm.org/) — tiling window manager
- [Neovim](https://neovim.io/) ≥ 0.11

## License

Personal use. Feel free to take what you need.
