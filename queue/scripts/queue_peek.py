"""Print the first lines of queue/queue.csv."""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    queue_root = Path(__file__).resolve().parent.parent
    path = queue_root / "queue.csv"
    if not path.is_file():
        print(f"Missing {path}", file=sys.stderr)
        return 1
    lines = path.read_text(encoding="utf-8").splitlines()
    print("\n".join(lines[:3]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
