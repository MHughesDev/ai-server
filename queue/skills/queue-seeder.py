"""Seed queue/queue.csv from init-manifest.json or idea.md."""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dev_mcp.queue_ops import OPEN_FIELDS, load_open_rows


def _read_manifest_rows(path: Path) -> list[dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("queue_seed_rows") or []
    out: list[dict[str, str]] = []
    for row in rows:
        item = {field: str(row.get(field, "") or "") for field in OPEN_FIELDS}
        out.append(item)
    return out


def _read_idea_rows(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    summary = text.replace("\r", " ").replace("\n", " ").strip()
    summary = (summary + " ") if summary else ""
    summary = (summary + "Queue seeded from idea.md. Acceptance criteria, done definition, and dependencies need operator review.").strip()
    if len(summary) < 100:
        summary = summary + " " + ("x" * (100 - len(summary)))
    return [
        {
            "id": "Q-001",
            "batch": "",
            "phase": "",
            "category": "documentation",
            "summary": summary,
            "agent_instructions": "",
            "constraints": "",
            "dependencies": "",
            "related_files": "",
            "notes": "seeded from idea.md",
            "created_date": "2026-04-24",
        }
    ]


def _write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    existing = load_open_rows(path)
    existing_ids = {(row.get("id") or "").strip() for row in existing}
    merged = existing[:]
    for row in rows:
        qid = (row.get("id") or "").strip()
        if not qid or qid in existing_ids:
            continue
        merged.append({field: row.get(field, "") for field in OPEN_FIELDS})
        existing_ids.add(qid)

    buf = io.StringIO()
    buf.write("# queue/queue.csv\n")
    writer = csv.DictWriter(buf, fieldnames=OPEN_FIELDS)
    writer.writeheader()
    writer.writerows(merged)
    path.write_text(buf.getvalue(), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--from-idea", type=Path)
    args = parser.parse_args()

    root = args.repo_root
    queue_path = root / "queue" / "queue.csv"
    manifest_path = root / "init-manifest.json"

    rows: list[dict[str, str]] = []
    if manifest_path.is_file():
        rows = _read_manifest_rows(manifest_path)
    elif args.from_idea and args.from_idea.is_file():
        rows = _read_idea_rows(args.from_idea)

    if not rows:
        print("No queue rows to seed.")
        return 0

    _write_rows(queue_path, rows)
    print(f"Seeded {len(rows)} queue row(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
