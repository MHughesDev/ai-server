#!/usr/bin/env bash
# scripts/skills-list.sh
# List available skill markdown files.

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python "$QUEUE_ROOT/scripts/skills_list.py"
