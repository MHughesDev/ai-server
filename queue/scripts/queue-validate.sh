#!/usr/bin/env bash
# scripts/queue-validate.sh
# Validate queue CSV schema (see scripts/queue_validate.py).

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python "$QUEUE_ROOT/scripts/queue_validate.py"
