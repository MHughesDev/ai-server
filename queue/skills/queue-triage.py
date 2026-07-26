# queue/skills/queue-triage.py
"""Summarize open queue rows: id, category, dependency count."""

from __future__ import annotations

import argparse
import csv
import io
import sys
from pathlib import Path


def load_open(path: Path) -> list[dict[str, str]]:
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    start = 1 if lines and lines[0].startswith("#") else 0
    reader = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    return list(reader)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    q = args.repo_root / "queue" / "queue.csv"
    if not q.is_file():
        print(f"Missing {q}", file=sys.stderr)
        return 1
    rows = load_open(q)
    print(f"Open items: {len(rows)}")
    for row in rows:
        if not row.get("id"):
            continue
        deps = [d.strip() for d in (row.get("dependencies") or "").split(",") if d.strip()]
        rf = [p.strip() for p in (row.get("related_files") or "").split(",") if p.strip()]
        print(
            f"  {row.get('id')} | {row.get('category')} | deps={len(deps)} | related_files={len(rf)}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
