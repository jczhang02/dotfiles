#!/usr/bin/env bash
set -euo pipefail
shopt -s globstar nullglob
files=(tests/**/*.test.ts)
if (( ${#files[@]} == 0 )); then
  echo "No tests found"
  exit 1
fi
bun test "${files[@]}"
