#!/usr/bin/env bash
# scripts/idea-to-queue.sh
# Seed queue/queue.csv from init-manifest.json queue_seed_rows (preferred) or idea.md fallback.

set -euo pipefail

QUEUE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$QUEUE_ROOT/.." && pwd)"

if [[ -f "$REPO_ROOT/init-manifest.json" ]] && python - <<'PY' "$REPO_ROOT/init-manifest.json"
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
rows = data.get('queue_seed_rows') or []
raise SystemExit(0 if rows else 1)
PY
then
  if [[ -f "$QUEUE_ROOT/skills/queue-seeder.py" ]]; then
    exec python "$QUEUE_ROOT/skills/queue-seeder.py" --repo-root "$REPO_ROOT"
  fi
  echo "queue_seed_rows present in init-manifest.json but queue/skills/queue-seeder.py not found" >&2
  exit 1
fi

if [[ -f "$REPO_ROOT/idea.md" ]]; then
  echo "queue_seed_rows not found in init-manifest.json; falling back to parsing idea.md (--from-idea)." >&2
  if [[ -f "$QUEUE_ROOT/skills/queue-seeder.py" ]]; then
    exec python "$QUEUE_ROOT/skills/queue-seeder.py" --repo-root "$REPO_ROOT" --from-idea "$REPO_ROOT/idea.md"
  fi
  echo "queue/skills/queue-seeder.py not found; cannot seed from idea.md" >&2
  exit 1
fi

echo "No init-manifest.json queue_seed_rows and no idea.md found; nothing to seed." >&2
exit 1
