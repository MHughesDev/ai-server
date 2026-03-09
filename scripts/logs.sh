#!/bin/bash
#
# View aggregated logs from all services
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Show logs with follow mode
docker-compose logs -f "$@"
