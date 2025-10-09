#!/bin/sh

echo "Starting DomaCross API with Celery..."

# Run Alembic migrations
echo "Running Alembic migrations..."
alembic upgrade head

# Start Celery worker with beat scheduler in the background
echo "Starting Celery worker with beat scheduler..."
su -c 'celery -A app.celery_app.celery_app worker --beat -c 1 --loglevel=info --logfile=celery.log &' appuser

# Give Celery a moment to start
sleep 2

# Start Uvicorn server (this will be the main process)
echo "Starting Uvicorn server..."
exec "$@"
