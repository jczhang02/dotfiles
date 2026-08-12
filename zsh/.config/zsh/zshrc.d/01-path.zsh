# ==== Function paths ====

typeset -U fpath FPATH

fpath=(
    "$XDG_CONFIG_HOME/zsh/completions"
    "$XDG_CONFIG_HOME/zsh/functions"
    $fpath
)
# Remove Zi paths inherited from shells that predate the XDG data migration.
fpath=(${fpath:#$ZDOTDIR/zi/*})
fpath=(${fpath:#${ZDOTDIR:A}/zi/*})
fpath=(${fpath:#rust/_rustc})
mailpath=(${mailpath:#$ZDOTDIR/zi/*})
mailpath=(${mailpath:#${ZDOTDIR:A}/zi/*})
