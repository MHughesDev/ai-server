#!/usr/bin/env bash
# scripts/queue-top-item.sh
# Print the first open queue row as one JSON line (entire item for agents).
# Use: make queue:top-item

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python "$QUEUE_ROOT/scripts/queue_top_item.py"
