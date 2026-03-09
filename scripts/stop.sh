#!/bin/bash
#
# Gracefully stop AI Server
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping AI Server..."

cd "$PROJECT_DIR"
docker-compose down --timeout 30

echo "AI Server stopped"
