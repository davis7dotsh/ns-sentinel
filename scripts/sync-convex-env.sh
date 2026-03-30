#!/usr/bin/env bash
set -euo pipefail

ROOT_ENV_FILE="${1:-.env}"
TARGET_ENV_FILE="${2:-packages/convex/.env.local}"
ROOT_ENV_LOCAL_FILE="${ROOT_ENV_FILE%.*}.env.local"

if [[ ! -f "$ROOT_ENV_FILE" && ! -f "$ROOT_ENV_LOCAL_FILE" ]]; then
  echo "Missing root env files: $ROOT_ENV_FILE or $ROOT_ENV_LOCAL_FILE" >&2
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
  line=""

  if [[ -f "$ROOT_ENV_FILE" ]]; then
    line="$(grep -E "^${key}=" "$ROOT_ENV_FILE" | tail -n 1 || true)"
  fi

  if [[ -f "$ROOT_ENV_LOCAL_FILE" ]]; then
    local_line="$(grep -E "^${key}=" "$ROOT_ENV_LOCAL_FILE" | tail -n 1 || true)"

    if [[ -n "$local_line" ]]; then
      line="$local_line"
    fi
  fi

  if [[ -z "$line" ]]; then
    echo "Missing required Convex env var in root env files: $key" >&2
    exit 1
  fi

  printf '%s\n' "$line" >> "$tmp_file"
done

mv "$tmp_file" "$TARGET_ENV_FILE"
echo "Synced Convex env to $TARGET_ENV_FILE"
