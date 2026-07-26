"""Validate queue files, then emit queue intelligence analysis JSON."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    queue_root = Path(__file__).resolve().parent.parent
    repo_root = queue_root.parent
    validate = subprocess.run(
        [sys.executable, str(queue_root / "scripts" / "queue_validate.py")],
        cwd=repo_root,
        check=False,
    )
    if validate.returncode != 0:
        return validate.returncode
    result = subprocess.run(
        [sys.executable, str(queue_root / "skills" / "queue-intelligence.py"), "analyze", "--repo-root", str(repo_root)],
        cwd=repo_root,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
