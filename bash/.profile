# Expose mise tools to POSIX login shells, including Moshi's SSH probes.
export PATH="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims:$PATH"
