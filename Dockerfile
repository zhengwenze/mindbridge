FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests
COPY skills ./skills
COPY models/mindbridge-qwen2.5-7b-ft/Modelfile ./models/mindbridge-qwen2.5-7b-ft/Modelfile
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh

RUN chmod +x scripts/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -fsS http://127.0.0.1:8080/actuator/health || exit 1

ENTRYPOINT ["/app/scripts/entrypoint.sh"]