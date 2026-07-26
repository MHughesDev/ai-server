# dev_mcp/queue_ops/__init__.py
"""Queue CSV read/validate helpers (stdlib only). Used by MCP tools and Make scripts."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

OPEN_FIELDS: list[str] = [
    "id",
    "batch",
    "phase",
    "category",
    "summary",
    "agent_instructions",
    "constraints",
    "dependencies",
    "related_files",
    "notes",
    "created_date",
]

ARCHIVE_HEADER: list[str] = OPEN_FIELDS + ["status", "completed_date"]

MIN_SUMMARY_LEN = 100


def load_open_rows(path: Path) -> list[dict[str, str]]:
    """Load all rows from the open queue CSV (after optional title comment line)."""

    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    start = 0
    if lines and lines[0].startswith("#"):
        start = 1
    body = "\n".join(lines[start:])
    reader = csv.DictReader(io.StringIO(body))
    if list(reader.fieldnames or []) != OPEN_FIELDS:
        msg = f"{path}: expected columns {OPEN_FIELDS}, got {reader.fieldnames}"
        raise ValueError(msg)
    return list(reader)


def top_item_dict(repo_root: Path) -> dict[str, str] | None:
    """First open row as a dict, or ``None`` if there are no data rows."""

    path = repo_root / "queue" / "queue.csv"
    if not path.is_file():
        return None
    rows = load_open_rows(path)
    if not rows:
        return None
    row = rows[0]
    return {k: (row.get(k) or "").strip() for k in OPEN_FIELDS}


def top_item_json_line(repo_root: Path) -> str:
    """One JSON line for agents (same shape as ``make queue:top-item``)."""

    path = repo_root / "queue" / "queue.csv"
    if not path.is_file():
        return json.dumps(
            {"error": "missing_file", "path": "queue/queue.csv"}, ensure_ascii=False
        )
    try:
        rows = load_open_rows(path)
    except ValueError as e:
        return json.dumps(
            {"error": "invalid_csv", "detail": str(e)}, ensure_ascii=False
        )
    if not rows:
        return json.dumps(
            {"error": "no_open_items", "message": "queue.csv has no data rows"},
            ensure_ascii=False,
        )
    row = rows[0]
    item = {k: (row.get(k) or "").strip() for k in OPEN_FIELDS}
    return json.dumps(item, ensure_ascii=False)


def _read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    start = 0
    if lines and lines[0].startswith("#"):
        start = 1
    reader = csv.DictReader(lines[start:])
    if reader.fieldnames is None:
        msg = f"{path}: missing header"
        raise ValueError(msg)
    header = [h.strip() for h in reader.fieldnames]
    rows = list(reader)
    return header, rows


def validate_queue_files(repo_root: Path) -> list[str]:
    """Return a list of validation error messages (empty if OK)."""

    q_open = repo_root / "queue" / "queue.csv"
    q_arch = repo_root / "queue" / "queuearchive.csv"
    errs: list[str] = []
    errs.extend(validate_open(q_open))
    errs.extend(validate_archive(q_arch))
    return errs


def validate_open(path: Path) -> list[str]:
    errors: list[str] = []
    header, rows = _read_rows(path)
    if header != OPEN_FIELDS:
        errors.append(f"{path}: expected header {OPEN_FIELDS}, got {header}")
        return errors
    for i, row in enumerate(rows, start=1):
        summary = (row.get("summary") or "").strip()
        if summary and len(summary) < MIN_SUMMARY_LEN:
            errors.append(
                f"{path} row {i}: summary must be empty or >= {MIN_SUMMARY_LEN} chars "
                f"(got {len(summary)})",
            )
    return errors


def validate_archive(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.exists():
        return errors
    header, _rows = _read_rows(path)
    if header != ARCHIVE_HEADER:
        errors.append(f"{path}: expected header {ARCHIVE_HEADER}, got {header}")
    return errors


def peek_queue_csv_head(repo_root: Path, lines: int = 3) -> str:
    """First ``lines`` of ``queue/queue.csv`` (title, header, first row, …)."""

    path = repo_root / "queue" / "queue.csv"
    if not path.is_file():
        return f"Missing {path}"
    raw = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(raw[:lines])
