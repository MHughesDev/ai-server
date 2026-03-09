#!/bin/bash
#
# Start AI Server with proper signal handling
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting AI Server..."

cd "$PROJECT_DIR"

# Check if already running
if docker-compose ps | grep -q "ai-server.*Up"; then
    echo "AI Server is already running"
    echo "Use './scripts/logs.sh' to view logs"
    exit 0
fi

# Start services
docker-compose up -d

echo ""
echo "Services starting..."
echo ""

# Wait for health check
echo -n "Waiting for health check..."
for i in {1..30}; do
    if curl -s http://localhost:3000/healthz | grep -q "healthy"; then
        echo " OK"
        echo ""
        echo "AI Server is running!"
        echo "  Health: http://localhost:3000/healthz"
        echo "  API: http://localhost:3000/v1/query"
        echo ""
        echo "View logs: ./scripts/logs.sh"
        exit 0
    fi
    sleep 1
    echo -n "."
done

echo ""
echo "Warning: Health check did not pass within 30 seconds"
echo "Check logs: ./scripts/logs.sh"
