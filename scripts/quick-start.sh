#!/bin/bash

# GitVizz Quick Start Script
# Simple script to quickly start the development environment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}🚀 GitVizz Quick Start${NC}"
echo "====================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Navigate to project root
cd "$PROJECT_ROOT"

# Start services with Docker Compose
echo -e "${BLUE}📦 Starting services with Docker Compose...${NC}"
docker-compose up -d

# Wait a moment for services to start
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Check if services are running
echo -e "${BLUE}🔍 Checking service status...${NC}"

# Check MongoDB
if curl -s http://localhost:27017 >/dev/null 2>&1 || docker ps | grep -q mongo; then
    echo "✅ MongoDB is running"
else
    echo "⚠️  MongoDB status unclear"
fi

# Check Backend
if curl -s http://localhost:8003/health >/dev/null 2>&1 || curl -s http://localhost:8003 >/dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "⚠️  Backend API status unclear"
fi

# Check Frontend
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Frontend status unclear"
fi

# Check Phoenix
if curl -s http://localhost:6006 >/dev/null 2>&1; then
    echo "✅ Phoenix observability is running"
else
    echo "⚠️  Phoenix status unclear"
fi

echo ""
echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend:     http://localhost:3000"
echo "  Backend API:  http://localhost:8003"
echo "  API Docs:     http://localhost:8003/docs"
echo "  Phoenix:      http://localhost:6006"
echo ""
echo "🛠️  Useful commands:"
echo "  View logs:    docker-compose logs -f"
echo "  Stop all:     docker-compose down"
echo "  Restart:      docker-compose restart"
echo ""
echo "📝 Note: Make sure to configure your environment variables in:"
echo "  - backend/.env"
echo "  - frontend/.env.local"
echo ""
