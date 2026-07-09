#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

is_port_free() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ! ss -ltn "( sport = :$port )" | grep -q ":$port"
    return
  fi

  return 0
}

if [ -z "${FRONTEND_PORT:-}" ]; then
  for candidate in 3000 3001 3002 3003 3004 3005; do
    if is_port_free "$candidate"; then
      export FRONTEND_PORT="$candidate"
      break
    fi
  done
fi

if [ -z "${FRONTEND_PORT:-}" ]; then
  echo "No free frontend port found in 3000-3005. Set FRONTEND_PORT manually."
  exit 1
fi

docker compose up -d --build
docker compose ps

echo
echo "MindBridge frontend dev server: http://localhost:${FRONTEND_PORT}"
echo "MindBridge backend API:          http://localhost:8080"
echo "Frontend code changes under ./frontend hot reload in the browser."
echo "Follow logs with: docker compose logs -f frontend app"
