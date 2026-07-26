#!/usr/bin/env bash
# scripts/queue-archive.sh
# Move a row from queue.csv to queuearchive.csv:
#   QUEUE_ID=<id> make queue:archive
#   make queue:archive-top   (archive first open row — no id)

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${ARCHIVE_TOP:-}" == "1" ]] || [[ "${1:-}" == "--top" ]]; then
  exec python "$QUEUE_ROOT/scripts/queue_archive.py" --top --root "$QUEUE_ROOT"
fi

if [[ -z "${QUEUE_ID:-}" ]]; then
  echo "Usage: QUEUE_ID=<id> make queue:archive" >&2
  echo "       make queue:archive-top   # archive top open row (no id)" >&2
  exit 1
fi

exec python "$QUEUE_ROOT/scripts/queue_archive.py" "$QUEUE_ID" --root "$QUEUE_ROOT"
