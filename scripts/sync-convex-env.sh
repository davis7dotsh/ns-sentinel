#!/usr/bin/env bash
set -euo pipefail

ROOT_ENV_FILE="${1:-.env}"
TARGET_ENV_FILE="${2:-packages/convex/.env.local}"

if [[ ! -f "$ROOT_ENV_FILE" ]]; then
  echo "Missing root env file: $ROOT_ENV_FILE" >&2
  exit 1
fi

required_keys=(
  "CONVEX_DEPLOYMENT"
  "CONVEX_URL"
  "CONVEX_SITE_URL"
  "CONVEX_PRIVATE_API_KEY"
)

tmp_file="$(mktemp)"
cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

for key in "${required_keys[@]}"; do
  line="$(grep -E "^${key}=" "$ROOT_ENV_FILE" | tail -n 1 || true)"

  if [[ -z "$line" ]]; then
    echo "Missing required Convex env var in $ROOT_ENV_FILE: $key" >&2
    exit 1
  fi

  printf '%s\n' "$line" >> "$tmp_file"
done

mv "$tmp_file" "$TARGET_ENV_FILE"
echo "Synced Convex env to $TARGET_ENV_FILE"
