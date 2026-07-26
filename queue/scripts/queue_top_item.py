# scripts/queue_top_item.py
"""Print the first open queue row as one line (JSON) for agents."""

from __future__ import annotations

import json
import sys
from pathlib import Path

QUEUE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(QUEUE_ROOT))

from dev_mcp.queue_ops import OPEN_FIELDS, load_open_rows


def main() -> int:
    path = QUEUE_ROOT / "queue.csv"
    if not path.is_file():
        err = {"error": "missing_file", "path": "queue/queue.csv"}
        print(json.dumps(err, ensure_ascii=False), file=sys.stderr)
        return 1
    try:
        rows = load_open_rows(path)
    except ValueError as e:
        err = {"error": "invalid_csv", "detail": str(e)}
        print(json.dumps(err, ensure_ascii=False), file=sys.stderr)
        return 1
    if not rows:
        empty = {"error": "no_open_items", "message": "queue.csv has no data rows"}
        print(json.dumps(empty, ensure_ascii=False))
        return 0
    row = rows[0]
    item = {k: (row.get(k) or "").strip() for k in OPEN_FIELDS}
    print(json.dumps(item, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
