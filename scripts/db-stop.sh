#!/usr/bin/env bash

set -euo pipefail

container_name="ns-sentinel-postgres-dev"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for db:stop."
  exit 1
fi

container_id="$(docker ps -aq -f "name=^${container_name}$")"

if [ -z "${container_id}" ]; then
  echo "No Postgres container named ${container_name} exists."
  exit 0
fi

if [ "$(docker inspect -f '{{.State.Running}}' "${container_name}")" != "true" ]; then
  echo "Postgres container ${container_name} is already stopped."
  exit 0
fi

docker stop "${container_name}" >/dev/null
echo "Stopped Postgres container ${container_name}."
