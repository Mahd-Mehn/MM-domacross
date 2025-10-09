# DomaCross API Dockerfile with Celery support
# This Dockerfile builds a container that runs both FastAPI and Celery worker

# Use Python 3.10 slim image
FROM python:3.10.12-slim

# Set the current working directory to /code
WORKDIR /code

# Copy the requirements.txt file to the /code directory
COPY ./requirements.txt /code/requirements.txt

# Update the package lists for upgrades and install gcc and libpq-dev
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install the package dependencies in the generated requirements.txt file
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy Alembic migrations
COPY ./alembic /code/alembic
COPY ./alembic.ini /code

# Copy the app directory to the /code directory
COPY ./app /code/app

# Copy the entrypoint script into the Docker image
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create a non-root user for running Celery
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /code

# Set the entry point to the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]

# Run the uvicorn command, telling it to use the app object imported from app.main
CMD ["uvicorn", "app.main:app", "--proxy-headers", "--host", "0.0.0.0", "--port", "8000"]
