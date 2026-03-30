#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
convex_dir="$repo_root/packages/convex"
build_script="$repo_root/scripts/build-dashboard-for-vercel.sh"

if [[ -z "${CONVEX_DEPLOY_KEY:-}" && -z "${CONVEX_DEPLOYMENT:-}" ]]; then
  echo "Missing CONVEX_DEPLOY_KEY or CONVEX_DEPLOYMENT for Convex deploy." >&2
  exit 1
fi

cd "$convex_dir"
"$convex_dir/node_modules/.bin/convex" deploy --cmd "bash \"$build_script\"" "$@"
