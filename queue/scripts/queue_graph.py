"""Emit the queue dependency graph in Mermaid format."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    queue_root = Path(__file__).resolve().parent.parent
    repo_root = queue_root.parent
    result = subprocess.run(
        [sys.executable, str(queue_root / "skills" / "queue-intelligence.py"), "graph", "--repo-root", str(repo_root)],
        cwd=repo_root,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
