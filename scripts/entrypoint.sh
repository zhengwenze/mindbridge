#!/usr/bin/env bash

set -euo pipefail

wait_for_service() {
    local host=$1
    local port=$2
    local name=$3
    local timeout=${4:-60}
    
    echo "Waiting for $name at $host:$port..."
    
    local start_time
    start_time=$(date +%s)
    while true; do
        if timeout 1 bash -c "echo > /dev/tcp/$host/$port"; then
            echo "$name is ready!"
            return 0
        fi

        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for $name"
            return 1
        fi
        
        sleep 1
    done
}

is_truthy() {
    case "${1:-}" in
        true|TRUE|1|yes|YES|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

pull_ollama_model() {
    local model=$1

    if [ -z "$model" ]; then
        return 0
    fi

    echo "Ensuring Ollama model is available: $model"
    curl -fsS -X POST "$OLLAMA_BASE_URL/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$model\"}" \
        | while IFS= read -r line; do
            python3 - "$line" <<'PY'
import json
import sys

try:
    payload = json.loads(sys.argv[1])
except json.JSONDecodeError:
    sys.exit(0)

status = payload.get("status")
error = payload.get("error")
if status:
    print(f"  {status}", flush=True)
if error:
    print(f"  error: {error}", flush=True)
PY
        done
}

if [ -n "$DATABASE_URL" ]; then
    db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    db_port=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:]*:\([0-9]*\).*/\1/p')
    wait_for_service "$db_host" "${db_port:-3306}" "MySQL" 120
fi

if [ -n "$REDIS_URL" ]; then
    redis_host=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/\([^:]*\):.*/\1/p')
    redis_port=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/[^:]*:\([0-9]*\).*/\1/p')
    wait_for_service "$redis_host" "${redis_port:-6379}" "Redis" 60
fi

if [ "${AI_PROVIDER,,}" != "mock" ] && [ -n "$OLLAMA_BASE_URL" ]; then
    ollama_host=$(echo "$OLLAMA_BASE_URL" | sed -n 's/http:\/\/\([^:]*\):.*/\1/p')
    ollama_port=$(echo "$OLLAMA_BASE_URL" | sed -n 's/http:\/\/[^:]*:\([0-9]*\).*/\1/p')
    wait_for_service "$ollama_host" "${ollama_port:-11434}" "Ollama" 120

    if is_truthy "${OLLAMA_AUTO_PULL:-false}"; then
        pull_ollama_model "${OLLAMA_MODEL:-}"
        pull_ollama_model "${EMBEDDING_MODEL:-qwen3-embedding:0.6b}"
    else
        echo "OLLAMA_AUTO_PULL=false, skipping Ollama model pulls."
    fi
elif [ "${AI_PROVIDER,,}" = "mock" ]; then
    echo "AI_PROVIDER=mock, skipping Ollama readiness checks."
fi

echo "All services are ready. Starting MindBridge..."

alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
