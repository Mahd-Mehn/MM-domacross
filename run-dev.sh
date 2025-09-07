#!/bin/bash

# DomaCross Development Runner
# This script sets up and runs the entire application stack for development

set -e

echo "🚀 Starting DomaCross Development Environment"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before continuing"
    exit 1
fi

# Start infrastructure
echo "🐳 Starting Docker services (PostgreSQL, Redis)..."
docker-compose up -d db redis

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Setup and run API
echo "🐍 Setting up API..."
cd apps/api
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python -m venv venv
fi

echo "🔧 Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

echo "🌱 Seeding database..."
python seed.py

echo "🚀 Starting API server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!

cd ../..

# Setup and run frontend
echo "⚛️  Setting up Frontend..."
cd apps/web

echo "📦 Installing Node.js dependencies..."
npm install

echo "🚀 Starting Next.js development server..."
npm run dev &
WEB_PID=$!

cd ../..

# Wait for services to start
echo "⏳ Waiting for servers to start..."
sleep 5

echo ""
echo "🎉 DomaCross is running!"
echo ""
echo "📊 Services:"
echo "  • API:        https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai"
echo "  • Frontend:   http://localhost:3000"
echo "  • Database:   localhost:5432"
echo "  • Redis:      localhost:6379"
echo ""
echo "📝 API Documentation: https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai/docs"
echo ""
echo "🛑 To stop: Ctrl+C or kill $API_PID $WEB_PID"

# Wait for interrupt
trap "echo '🛑 Shutting down...'; kill $API_PID $WEB_PID 2>/dev/null; docker-compose down; exit" INT
wait
