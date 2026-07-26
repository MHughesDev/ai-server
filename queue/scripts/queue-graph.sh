#!/usr/bin/env bash
# scripts/queue-graph.sh
# Emit Mermaid dependency graph from queue via queue-intelligence.py.

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$QUEUE_ROOT/.." && pwd)"
exec python "$QUEUE_ROOT/skills/queue-intelligence.py" graph --repo-root "$REPO_ROOT"
