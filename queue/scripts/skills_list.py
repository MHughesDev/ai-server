"""List available local skills."""

from __future__ import annotations

from pathlib import Path


def main() -> int:
    queue_root = Path(__file__).resolve().parent.parent
    repo_root = queue_root.parent
    skills_dir = queue_root / "skills"
    if not skills_dir.is_dir():
        print("No skills directory found.")
        return 0

    files = sorted(
        path.relative_to(repo_root).as_posix()
        for path in skills_dir.rglob("*.md")
        if path.is_file()
    )
    for file in files:
        print(file)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
