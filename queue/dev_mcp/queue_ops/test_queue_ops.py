# dev_mcp/queue_ops/test_queue_ops.py
"""Tests for queue CSV helpers used by MCP and scripts."""

from __future__ import annotations

import csv
import shutil
import sys
import unittest
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dev_mcp.queue_ops import OPEN_FIELDS, load_open_rows, validate_open


class QueueOpsTests(unittest.TestCase):
    def _case_dir(self) -> Path:
        root = Path(__file__).resolve().parents[2] / ".tmp" / "queue_ops_tests" / uuid4().hex
        root.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(root, ignore_errors=True))
        return root

    def test_load_open_rows_roundtrip(self) -> None:
        long_summary = "x" * 100
        p = self._case_dir() / "queue.csv"
        with p.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=OPEN_FIELDS)
            w.writeheader()
            w.writerow(
                dict.fromkeys(OPEN_FIELDS, "") | {"id": "Q-999", "summary": long_summary}
            )
        rows = load_open_rows(p)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], "Q-999")
        self.assertEqual(rows[0]["summary"], long_summary)


    def test_validate_open_rejects_short_non_empty_summary(self) -> None:
        p = self._case_dir() / "queue.csv"
        with p.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=OPEN_FIELDS)
            w.writeheader()
            w.writerow(dict.fromkeys(OPEN_FIELDS, "") | {"id": "Q-001", "summary": "short"})
        errs = validate_open(p)
        self.assertTrue(errs)


if __name__ == "__main__":
    unittest.main()
