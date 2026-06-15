#!/usr/bin/env bash
set -euo pipefail

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
cfg="$tmp/config.json"
out="$tmp/out.txt"
err="$tmp/err.txt"
combined="$tmp/combined.txt"

if ! command -v pi >/dev/null 2>&1; then
  echo "global cli e2e skipped: pi not found"
  exit 0
fi

printf '{"enabled":true,"backend":"ui","quietSeconds":0,"sound":false}\n' > "$cfg"
(cd "$repo_root" && PI_NOTIFY_CONFIG="$cfg" pi --offline --no-tools --no-skills --no-prompt-templates --no-themes -p '/notify backend osc99') >"$out" 2>"$err"
node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(c.backend!=='osc99') throw new Error('backend command did not update global config');" "$cfg"

printf '{"enabled":true,"backend":"osc777","quietSeconds":0,"sound":false}\n' > "$cfg"
(cd "$repo_root" && PI_NOTIFY_CONFIG="$cfg" pi --offline --no-tools --no-skills --no-prompt-templates --no-themes -p '/notify test') >"$out" 2>"$err"
cat "$out" "$err" > "$combined"
grep -aF $'\033]777;notify;Pi notify test - agent;Test notification' "$combined" >/dev/null
grep -aF "Project: $(basename "$repo_root") ($repo_root)" "$combined" >/dev/null

echo "global cli e2e ok"
