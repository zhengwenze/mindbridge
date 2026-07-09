#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose up -d --build
docker compose ps

echo
echo "MindBridge is starting at http://localhost:8080"
echo "Follow logs with: docker compose logs -f app"
