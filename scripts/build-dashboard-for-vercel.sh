#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dashboard_dir="$repo_root/apps/dashboard"
dashboard_output_dir="$dashboard_dir/.vercel/output"
repo_output_dir="$repo_root/.vercel/output"

rm -rf "$dashboard_output_dir" "$repo_output_dir"
mkdir -p "$repo_root/.vercel"

cd "$dashboard_dir"
"$dashboard_dir/node_modules/.bin/svelte-kit" sync
"$dashboard_dir/node_modules/.bin/vite" build

if [[ ! -d "$dashboard_output_dir" ]]; then
  echo "Expected dashboard Vercel output at $dashboard_output_dir after build." >&2
  exit 1
fi

mv "$dashboard_output_dir" "$repo_output_dir"
echo "Copied dashboard Vercel output to $repo_output_dir"
