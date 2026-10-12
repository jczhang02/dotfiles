#!/usr/bin/env bash
# PreToolUse guard for Bash, Write, Edit, WebFetch and Grep: keep agents away
# from the blog's About page content (~/dev/blog/src/content/about/), which
# only JC reads and edits, and from the copies a build makes of it. Permission
# deny rules already stop the file tools; this catches shell commands, scripts
# and URLs that would reach it. It stops accidental and casual access, not a
# determined one. Layout work uses src/about.sample/ on port 4399.
input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
fp=$(jq -r '.tool_input.file_path // .tool_input.path // empty' <<<"$input")
case "$tool" in
  Bash) text=$(jq -r '.tool_input.command // empty' <<<"$input") ;;
  Write) text=$(jq -r '.tool_input.content // empty' <<<"$input") ;;
  Edit) text=$(jq -r '.tool_input.new_string // empty' <<<"$input") ;;
  WebFetch) text=$(jq -r '.tool_input.url // empty' <<<"$input") ;;
  Grep) text=$(jq -r '[.tool_input.path // "", .tool_input.glob // ""] | join(" ")' <<<"$input") ;;
  *) exit 0 ;;
esac

blog="$HOME/dev/blog"
# Quotes, backslashes, ./ and doubled slashes do not change a path.
norm=$(sed -E "s/[\"'\\\\]//g; s#/(\./)+#/#g; s#/{2,}#/#g; s#%61#a#g; s#%2[fF]#/#g" <<<"$text")

in_blog=false
[[ "$cwd" == "$blog" || "$cwd" == "$blog"/* || "$fp" == "$blog"/* ]] && in_blog=true
grep -Eq 'dev/blog|(^|[[:space:]=(])blog/(src|dist|\.astro|node_modules)' <<<"$norm" && in_blog=true

# A glob whose literal part is a prefix of "about" can match the folder.
G='(a(b(o(ut?)?)?)?)?[*?[{]'
# The content, the built pages, the caches (also through globs and **).
PRIVATE="content/+(about|$G)|dist/+(en/+)?(about|$G)|(^|[[:space:]=(:])(\./)?(src/+|dist/+)?\*\*|(^|[[:space:]=(:])(\./)?src/+(c(o(n(t(e(nt?)?)?)?)?)?)?[*?[{]|node_modules/+\.(astro|vite)|(^|[[:space:]=(/])\.astro(/|[[:space:]);]|$)"
# The content folder itself, as a directory to walk (not content.config.ts).
WALKED='src/+content/*([^/[:alnum:]._-]|$)'
# Hosts of a local server; port 4399 (sample) is allowed.
LOCAL='(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[0-9]{1,3}(\.[0-9]{1,3}){3})'

# A path that is the repo, src/, src/content/ or dist/ (or a glob): a
# recursive reader started there reaches the content.
is_parent() {
  local w=${1%/}
  w=${w#./}
  case "$w" in
    '' | . | src | src/content | dist | dist/en | '*' | *'*'* | ~ | "$HOME" | '$HOME' | '$PWD' | '${PWD}') return 0 ;;
    *dev/blog | *dev/blog/src | *dev/blog/src/content | *dev/blog/dist | *dev/blog/dist/en) return 0 ;;
    ..) [[ "$cwd" == "$blog"/* ]] && return 0 ;;
  esac
  return 1
}

# True if a recursive grep (also rtk grep, env-prefixed, in $(...)) or a find
# that runs a command (-exec, xargs) starts from a folder above the content.
recursive_reader_reaches_about() {
  local seg word paths pattern_seen explicit
  local cmdline=$1
  local has_exec=false
  grep -Eq '[[:space:]]-(exec|execdir|ok|okdir)([[:space:]]|$)|\|[[:space:]]*xargs' <<<"$cmdline" && has_exec=true
  while read -r seg; do
    seg=$(sed -E 's/^[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*|rtk|command|exec|sudo|nice|env|time|\\)[[:space:]]+|timeout[[:space:]]+[0-9.]+[smh]?[[:space:]]+|xargs([[:space:]]+-[^[:space:]]+)*[[:space:]]+)*//; s#^/usr/bin/##; s#^\\##' <<<"$seg")
    if grep -Eq '^(e|f)?grep[[:space:]]' <<<"$seg" &&
      grep -Eq '[[:space:]](-[[:alpha:]]*[rR][[:alpha:]]*|--recursive|--dereference-recursive|-d[[:space:]]*recurse|--directories=recurse)([[:space:]]|$)' <<<"$seg"; then
      paths=() pattern_seen=false explicit=false
      grep -Eq '[[:space:]](-e|-f|--regexp|--file)([[:space:]=]|$)' <<<"$seg" && explicit=true
      for word in $seg; do
        case "$word" in
          grep | egrep | fgrep | -*) ;;
          *) if ! $explicit && ! $pattern_seen; then pattern_seen=true; else paths+=("$word"); fi ;;
        esac
      done
      [ ${#paths[@]} -eq 0 ] && return 0
      for word in "${paths[@]}"; do is_parent "$word" && return 0; done
    elif $has_exec && grep -Eq '^find([[:space:]]|$)' <<<"$seg"; then
      paths=()
      for word in ${seg#find}; do
        case "$word" in -* | '(' | '!') break ;; *) paths+=("$word") ;; esac
      done
      [ ${#paths[@]} -eq 0 ] && return 0
      for word in "${paths[@]}"; do is_parent "$word" && return 0; done
    fi
  done < <(sed -E 's/\$\(/\n/g' <<<"$cmdline" | tr '|;&()`' '\n\n\n\n\n\n')
  return 1
}

reason=''
if grep -Eq '(^|[^[:alnum:]-])jczhang\.cc/+(en/+)?about' <<<"$norm"; then
  # The live page, from anywhere.
  reason='the live About page is private to JC'
elif grep -Eq "$LOCAL:432[0-9]/+((en/+)?about|[^[:space:]]*(content/+about|node_modules/+\.(astro|vite)|\.astro/|dist/+(en/+)?about))" <<<"$norm"; then
  # Astro's dev and preview ports, from any directory (the blog-post skill
  # runs elsewhere and reuses the blog's dev server).
  reason='a dev server other than the sample one (port 4399) shows the real About page'
elif [ "$tool" = Bash ] && [[ "$cwd" == "$blog"/src/content/about* || "$cwd" == "$blog"/dist/about* || "$cwd" == "$blog"/dist/en/about* || "$cwd" == "$blog"/.astro* || "$cwd" == "$blog"/node_modules/.astro* || "$cwd" == "$blog"/node_modules/.vite* ]]; then
  reason='the working directory holds the About content or a build copy'
elif $in_blog; then
  if [[ "$tool" =~ ^(Bash|Grep)$ ]] && grep -Eq "$PRIVATE" <<<"$norm"; then
    reason='the About content and its build copies are private to JC'
  elif [[ "$tool" =~ ^(Write|Edit)$ ]] &&
    grep -Eq "(read[A-Za-z]*\(|open\(|Bun\.file|fs\.[a-z]|walk|glob[A-Za-z]*\(|iterdir|listdir|scandir|goto\(|fetch\(|(^|[[:space:]])(cat|head|tail|sed|awk|cp|tar|rsync|zip)[[:space:]])[^\n]*($PRIVATE|$WALKED)" <<<"$norm"; then
    # A script that reads or walks the content, run later by Bash.
    reason='a script that reads the About content or its build copies'
  elif [ "$tool" = Bash ] && [[ "$cwd" == "$blog"/src/content || "$cwd" == "$blog"/dist || "$cwd" == "$blog"/dist/en ||
    "$norm" =~ (^|[[:space:]\;\&\|\(])cd[[:space:]]+([^[:space:]\;\&\|]*/)?(content|dist|en)/*([[:space:]\;\&\|\)]|$) ]] &&
    grep -Eq '(^|[[:space:]=(])(\./)?(about|\*|a\*)(/|[[:space:];&|)]|$)' <<<"$norm"; then
    reason='the About content and its build copies are private to JC'
  elif [ "$tool" = Bash ] && grep -Eq '\b(rg|fd)\b[^|;&]*[[:space:]](--no-ignore[[:alnum:]-]*|--unrestricted|-[[:alpha:]]*u)|\bfd\b[^|;&]*[[:space:]]-[[:alpha:]]*I' <<<"$norm"; then
    reason='rg/fd without ignore files would search the About content'
  elif [ "$tool" = Bash ] && grep -Eq 'git[[:space:]]+(-[^[:space:]]+[[:space:]]+)*(diff|show|log|format-patch|grep|whatchanged)\b[^|;&]*[[:space:]](--text|-[[:alpha:]]*a)([[:space:]]|$)|git[[:space:]]+(-[^[:space:]]+[[:space:]]+)*(archive|bundle)\b|\btar[[:space:]]+[^|;&]*-[[:alpha:]]*O' <<<"$norm"; then
    reason='git text output (--text, archive) ignores the -diff guard on the About content'
  elif [ "$tool" = Bash ] && recursive_reader_reaches_about "$norm"; then
    reason='a recursive grep or find -exec over the repo, src/, src/content/ or dist/ would read the About content'
  elif grep -Eq "$LOCAL(:[0-9]+)?" <<<"$norm" && ! grep -Eq "$LOCAL:4399([^0-9]|$)" <<<"$norm" &&
    grep -Eq "/+(en/+)?about(/|[[:space:]'\"?#\`]|$)" <<<"$text"; then
    # A local server URL plus an /about path anywhere (base + '/about/').
    reason='a dev server other than the sample one (port 4399) shows the real About page'
  elif [ "$tool" = Bash ] && grep -Eq "(wget[^|;&]*[[:space:]](-r|-m|--recursive|--mirror)|linkinator|lychee|muffet|httrack|blc[[:space:]])[^|;&]*$LOCAL" <<<"$norm" && ! grep -Eq "$LOCAL:4399([^0-9]|$)" <<<"$norm"; then
    reason='a crawler of a dev server other than the sample one (port 4399) fetches the real About page'
  fi
fi
[ -n "$reason" ] || exit 0

jq -n --arg r "Blocked: $reason. Agents never read or change the About page content. To work on its layout, use the sample data in src/about.sample/ with \`bun run dev:sample\` (port 4399) or \`LEMMA_ABOUT=sample bun run build\`." \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
