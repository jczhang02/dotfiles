# ==== Prompt and syntax highlighting ====

if [[ ! -o monitor ]] || (( ${terminfo[colors]:-0} < 256 )); then
    PROMPT='%n@%m:%~%# '
    RPROMPT=''
    return 0
fi

if (( ${ZI_AVAILABLE:-0} )); then
    zi light romkatv/powerlevel10k
    source "$ZDOTDIR/p10k.zsh"
fi

# F-Sy-H remains the final ZLE hook; the primary theme is the vendored
# Catppuccin file. fsh_theme saves it as data in current_theme.ini, which
# records the source path, so reapply only when that file is missing, points
# elsewhere, or is older than the vendored theme.
typeset _fsyh_theme="$XDG_CONFIG_HOME/f-sy-h/catppuccin-latte.ini"
typeset _fsyh_state="$XDG_CACHE_HOME/f-sy-h/current_theme.ini"
zstyle ':fsh:config' work-dir "$XDG_CACHE_HOME/f-sy-h"
if (( ${ZI_AVAILABLE:-0} )); then
    if zi light z-shell/F-Sy-H \
        && (( $+functions[fsh_theme] )) \
        && [[ ! -r $_fsyh_state || $_fsyh_theme -nt $_fsyh_state
            || $'\n'$(<$_fsyh_state)$'\n' != *$'\n'"path=$_fsyh_theme"$'\n'* ]]; then
        # Vendored from catppuccin/zsh-fsh at a9bdf479; see its MIT license.
        fsh_theme -q "$_fsyh_theme"
    fi
fi
unset _fsyh_theme _fsyh_state
