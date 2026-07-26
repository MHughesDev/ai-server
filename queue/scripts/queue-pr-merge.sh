#!/usr/bin/env bash
# scripts/queue-pr-merge.sh
# Merge an open PR with a merge commit and delete the head branch (GitHub).
# Requires: gh CLI, authenticated (gh auth login).
#
# Queue completion order (this script is LAST — after archive + validate):
#   1. make queue:archive-top   # or queue:archive QUEUE_ID=…
#   2. make queue:validate
#   3. make queue:pr-merge       # this file: gh pr merge --merge --delete-branch
#
# From the PR branch:
#     make queue:pr-merge
# When you are on another branch but know the PR number:
#     PR_NUMBER=123 make queue:pr-merge
# Extra gh flags after -- are passed through (e.g. --admin if your policy allows).

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "queue-pr-merge: gh (GitHub CLI) is not installed or not on PATH." >&2
  echo "Install: https://cli.github.com/ — then run: gh auth login" >&2
  exit 1
fi

if [[ -n "${PR_NUMBER:-}" ]]; then
  exec gh pr merge "$PR_NUMBER" --merge --delete-branch "$@"
fi

exec gh pr merge --merge --delete-branch "$@"
