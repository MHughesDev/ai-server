#!/usr/bin/env bash
# scripts/queue-analyze.sh
# Validate queue CSV then run full queue intelligence analysis.

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$QUEUE_ROOT/.." && pwd)"
python "$QUEUE_ROOT/scripts/queue_validate.py" || exit 1
exec python "$QUEUE_ROOT/skills/queue-intelligence.py" analyze --repo-root "$REPO_ROOT"
