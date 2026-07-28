# ==== Shell integrations ====

# Cache generated integration scripts until their executable changes. This
# avoids four subprocesses and reparsing their output on every shell.
typeset -g _ZSH_GENERATED_CACHE_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/zsh/generated
command mkdir -p -m 700 -- "$_ZSH_GENERATED_CACHE_DIR"

function _zsh_source_cached() {
    local name=$1 executable=$2
    shift 2

    local command_path=${commands[$executable]:-}
    [[ -n $command_path ]] || return 0

    local cache_file="$_ZSH_GENERATED_CACHE_DIR/$name.zsh"
    local tmp_file
    if [[ ! -s $cache_file || $command_path -nt $cache_file \
        || $ZSHCONF/02-module.zsh -nt $cache_file \
        || $ZSHCONF/04-plugin.zsh -nt $cache_file ]]; then
        tmp_file=$(mktemp "$_ZSH_GENERATED_CACHE_DIR/$name.XXXXXX") || return 1
        if "$command_path" "$@" >| "$tmp_file"; then
            command chmod 600 -- "$tmp_file"
            command mv -f -- "$tmp_file" "$cache_file"
            command rm -f -- "$cache_file.zwc"
        else
            command rm -f -- "$tmp_file"
            print -u2 -- "zsh: failed to generate $name integration"
            return 1
        fi
    fi

    if [[ ! -s $cache_file.zwc || $cache_file -nt $cache_file.zwc ]]; then
        zcompile -R "$cache_file.zwc" "$cache_file" 2>/dev/null \
            && command chmod 600 -- "$cache_file.zwc"
    fi
    source "$cache_file"
}

_zsh_source_cached direnv-hook direnv hook zsh
if (( $+commands[mise] )); then
    # The generated activation normally runs hook-env immediately and again
    # before the first prompt. Keep the official wrapper while invoking the
    # environment hook exactly once through the normal prompt/chdir lifecycle.
    _zsh_source_cached mise-activate-no-initial mise activate zsh --no-hook-env

    autoload -Uz add-zsh-hook
    function _mise_hook() {
        eval "$(command mise hook-env -s zsh)"
    }
    function _mise_hook_precmd() {
        if [[ ${__MISE_ZSH_CHPWD_RAN:-0} == 1 ]]; then
            export __MISE_ZSH_CHPWD_RAN=0
            return 0
        fi
        eval "$(command mise hook-env -s zsh --reason precmd)"
    }
    function _mise_hook_chpwd() {
        export __MISE_ZSH_CHPWD_RAN=1
        eval "$(command mise hook-env -s zsh --reason chpwd)"
    }
    add-zsh-hook precmd _mise_hook_precmd
    add-zsh-hook chpwd _mise_hook_chpwd

    # Prime the initial directory now, then make the first precmd skip the
    # otherwise-duplicate hook invocation.
    _mise_hook
    export __MISE_ZSH_CHPWD_RAN=1
fi

# ZLE integrations require a controlling terminal. Powerlevel10k instant
# prompt temporarily redirects stdin/stdout while this file is sourced, so
# checking `-t 0`/`-t 1` here would incorrectly disable fzf and Atuin in real
# terminals. Opening /dev/tty distinguishes that path from bare `zsh -ilc`.
if [[ -o interactive ]] && { : </dev/tty >/dev/tty } 2>/dev/null; then
    _zsh_source_cached fzf-zsh fzf --zsh
    _zsh_source_cached atuin-zsh atuin init zsh --disable-up-arrow
fi

# 1Password generates this file after `op plugin init`. Follow the standard
# Shell Plugin behavior when the owned local Claude build and generated shell
# integration are present and not writable by group/other users. Drop inherited
# plaintext credentials first so only the plugin can provision them to Claude.
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN
typeset -g _CLAUDE_BIN=${commands[claude]:-}
typeset -g _OP_CONFIG_DIR=${OP_CONFIG_DIR:-$XDG_CONFIG_HOME/op}
typeset -g _OP_PLUGINS_FILE="$_OP_CONFIG_DIR/plugins.sh"
typeset -g _OP_LOCAL_CLAUDE_PLUGIN="$_OP_CONFIG_DIR/plugins/local/anthropic"
typeset _op_plugins_mode _op_claude_plugin_mode
_op_plugins_mode=$(stat -c '%a' -- "$_OP_PLUGINS_FILE" 2>/dev/null)
_op_claude_plugin_mode=$(stat -c '%a' -- "$_OP_LOCAL_CLAUDE_PLUGIN" 2>/dev/null)

if [[ -r $_OP_PLUGINS_FILE && -O $_OP_PLUGINS_FILE \
    && -x $_OP_LOCAL_CLAUDE_PLUGIN && -O $_OP_LOCAL_CLAUDE_PLUGIN \
    && $_op_plugins_mode == <-> && $_op_claude_plugin_mode == <-> ]] \
    && (( (8#$_op_plugins_mode & 8#022) == 0 \
        && (8#$_op_claude_plugin_mode & 8#022) == 0 )); then
    source "$_OP_PLUGINS_FILE"
fi

if (( ! ${+aliases[claude]} && ! ${+functions[claude]} )); then
    function claude() {
        case ${1:-} in
            -h | --help | -v | --version)
                [[ -n $_CLAUDE_BIN ]] || return 127
                command "$_CLAUDE_BIN" "$@"
                ;;
            *)
                print -u2 -- 'claude: the local 1Password Shell Plugin is not initialized.'
                print -u2 -- 'Run op plugin init claude, then start a new terminal.'
                return 126
                ;;
        esac
    }
fi

unset _op_plugins_mode _op_claude_plugin_mode
