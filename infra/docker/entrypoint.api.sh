#!/bin/sh
set -e

echo "[entrypoint] Running Alembic migrations..."
# Navigate to app root containing alembic.ini
cd /app
# Use python -m alembic to ensure correct module resolution
alembic upgrade head || { echo "[entrypoint] Alembic migration failed"; exit 1; }

echo "[entrypoint] Starting API server..."
exec "$@"
