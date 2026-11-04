# Follow the GNOME light or dark scheme in glamour, the Markdown renderer of
# gh (issue view, pr view, repo view) and glow, as 07-bat-theme.zsh does for bat.
# GLAMOUR_STYLE takes a built-in name or a JSON file; the Catppuccin files
# match the Ghostty theme.
_glamour_theme_sync() {
  if [[ $(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null) == *dark* ]]; then
    export GLAMOUR_STYLE=$XDG_CONFIG_HOME/glamour/catppuccin-mocha.json
  else
    export GLAMOUR_STYLE=$XDG_CONFIG_HOME/glamour/catppuccin-latte.json
  fi
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd _glamour_theme_sync
