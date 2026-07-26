"""Merge the current PR, or a specific PR number, using the GitHub CLI."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("extra", nargs="*")
    parser.add_argument("--pr-number", dest="pr_number")
    args = parser.parse_args()

    if shutil.which("gh") is None:
        print("queue-pr-merge: gh (GitHub CLI) is not installed or not on PATH.", file=sys.stderr)
        print("Install: https://cli.github.com/ and run: gh auth login", file=sys.stderr)
        return 1

    pr_number = args.pr_number or os.environ.get("PR_NUMBER")
    cmd = ["gh", "pr", "merge"]
    if pr_number:
        cmd.append(pr_number)
    cmd.extend(["--merge", "--delete-branch"])
    cmd.extend(args.extra)
    return subprocess.run(cmd, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
