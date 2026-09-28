# tmux-autoname: sync the tmux window name on command start/finish and cd.
if [[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/tmux/plugins/tmux-autoname/integrations/tmux-autoname.zsh" ]]; then
  source "${XDG_CONFIG_HOME:-$HOME/.config}/tmux/plugins/tmux-autoname/integrations/tmux-autoname.zsh"
fi
