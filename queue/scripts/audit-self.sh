#!/usr/bin/env bash
# scripts/audit-self.sh
# Queue-system self-audit.

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python "$QUEUE_ROOT/scripts/audit_self.py"
