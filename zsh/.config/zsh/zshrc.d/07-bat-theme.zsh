# Follow the GNOME light or dark scheme in bat, as git's delta-auto does.
# BAT_THEME=light|dark selects --theme-light or --theme-dark from the bat config.
# Piped bat (fzf-tab, fzf-preview, MANPAGER) cannot query the terminal, so
# --theme=auto alone falls back to bat's built-in default there.
_bat_theme_sync() {
  if [[ $(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null) == *dark* ]]; then
    export BAT_THEME=dark
  else
    export BAT_THEME=light
  fi
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd _bat_theme_sync
