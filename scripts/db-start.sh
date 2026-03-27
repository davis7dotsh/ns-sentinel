#!/usr/bin/env bash

set -euo pipefail

container_name="ns-sentinel-postgres-dev"
volume_name="ns-sentinel-postgres-data"
image_name="postgres:17"
host_port="${POSTGRES_PORT:-5432}"
database_name="${POSTGRES_DB:-ns_sentinel_dev}"
database_user="${POSTGRES_USER:-postgres}"
database_password="${POSTGRES_PASSWORD:-postgres}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for db:start."
  exit 1
fi

container_id="$(docker ps -aq -f "name=^${container_name}$")"

if [ -n "${container_id}" ]; then
  if [ "$(docker inspect -f '{{.State.Running}}' "${container_name}")" = "true" ]; then
    echo "Postgres is already running in container ${container_name}."
    exit 0
  fi

  docker start "${container_name}" >/dev/null
  echo "Started existing Postgres container ${container_name}."
  exit 0
fi

docker volume create "${volume_name}" >/dev/null

docker run \
  --detach \
  --name "${container_name}" \
  --restart unless-stopped \
  --publish "${host_port}:5432" \
  --env "POSTGRES_DB=${database_name}" \
  --env "POSTGRES_USER=${database_user}" \
  --env "POSTGRES_PASSWORD=${database_password}" \
  --volume "${volume_name}:/var/lib/postgresql/data" \
  "${image_name}" >/dev/null

echo "Started Postgres in container ${container_name} on localhost:${host_port}."
echo "DATABASE_URL=postgres://${database_user}:${database_password}@localhost:${host_port}/${database_name}"
