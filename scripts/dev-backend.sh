#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose up -d

echo
echo "Docker backend services:"
docker compose ps app mysql redis

echo
echo "FastAPI: http://localhost:8000"
echo "MySQL:  127.0.0.1:13306"
echo "Redis:  127.0.0.1:16379"
echo "Chroma: embedded in the app service; persistent data is under ./data/chroma"
