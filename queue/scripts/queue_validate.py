# scripts/queue_validate.py
"""Validate queue/queue.csv and queue/queuearchive.csv schema and invariants."""

from __future__ import annotations

import sys
from pathlib import Path

QUEUE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(QUEUE_ROOT))

from dev_mcp.queue_ops import validate_archive, validate_open


def main() -> int:
    q_open = QUEUE_ROOT / "queue.csv"
    q_arch = QUEUE_ROOT / "queuearchive.csv"
    errs: list[str] = []
    errs.extend(validate_open(q_open))
    errs.extend(validate_archive(q_arch))
    if errs:
        for e in errs:
            print(e, file=sys.stderr)
        return 1
    print("Queue OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
