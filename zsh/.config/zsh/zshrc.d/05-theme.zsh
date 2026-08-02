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

# F-Sy-H remains the final ZLE hook. An empty secondary theme prevents its
# optional network fallback; the primary theme is the vendored Catppuccin file.
typeset _fsyh_theme="$XDG_CONFIG_HOME/f-sy-h/catppuccin-latte.ini"
typeset -g FAST_WORK_DIR="$XDG_CACHE_HOME/f-sy-h"
if (( ${ZI_AVAILABLE:-0} )); then
    command mkdir -p -m 700 -- "$FAST_WORK_DIR"
    [[ -e $FAST_WORK_DIR/secondary_theme.zsh ]] \
        || command touch -- "$FAST_WORK_DIR/secondary_theme.zsh"

    if zi light z-shell/F-Sy-H \
        && (( $+functions[fast-theme] )) \
        && [[ ${FAST_THEME_NAME:-} != catppuccin-latte \
            || ! -r $FAST_WORK_DIR/current_theme.zsh \
            || $_fsyh_theme -nt $FAST_WORK_DIR/current_theme.zsh ]]; then
        # Vendored from catppuccin/zsh-fsh at a9bdf479; see its MIT license.
        fast-theme -q "$_fsyh_theme"
    fi
fi
unset _fsyh_theme
