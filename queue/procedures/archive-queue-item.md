---
doc_id: "5.6"
title: "archive queue item"
section: "Procedures"
summary: "SOP: Move completed queue row to archive with required fields, then update GitHub (merge PR + delete branch)."
updated: "2026-04-17"
---

# 5.6 — archive queue item

<!-- CROSS-REFERENCES -->
<!-- - Rule: .cursor/rules/queue.md (archive-before-delete policy) -->
<!-- - Make target: make queue:archive -->

**Purpose:** SOP: Move completed queue row to archive with required fields, then update GitHub (merge PR + delete branch). Per spec §26.5 item 145 and §8.3.

## 5.6.1 Purpose

Proper archiving ensures queue history is preserved and the next queue item becomes the active one. **`make queue:pr-merge`** runs **after** the row is archived and **`make queue:validate`** passes — it updates GitHub (`gh pr merge --merge --delete-branch`) so the open PR merges and the remote head branch is removed.

## 5.6.2 Trigger / When to Use

When implementation is complete: CI green, PR open, PR URL in queue notes, and you are ready to close the item. **Cancelled/superseded** items: archive only (no `queue:pr-merge`).

## 5.6.3 Prerequisites

- Open PR for the work (branch pushed; PR URL in notes).
- [GitHub CLI](https://cli.github.com/) installed and `gh auth login` for **`make queue:pr-merge`**.

## 5.6.4 Exact Commands

- **`make queue:archive-top`** — archives the **top** (first) open row; no `QUEUE_ID` (preferred when that row is the completed item).
- **`make queue:archive QUEUE_ID=<id>`** — archive a specific id, or edit CSV manually per **`queue/QUEUE_INSTRUCTIONS.md`**.
- **`make queue:validate`** — must pass after archive.
- **`make queue:pr-merge`** — after validate: `gh pr merge --merge --delete-branch`. From the PR branch, or **`PR_NUMBER=<n> make queue:pr-merge`** from another branch.

## 5.6.5 Ordered Steps

1. Confirm CI green and acceptance criteria met; PR URL is in queue **notes**.
2. Run **`make queue:archive-top`** (if the completed item is the top open row) **or** **`make queue:archive QUEUE_ID=<id>`** — move the row to `queuearchive.csv` with `status=done`, `completed_date`, PR URL in notes; remove from `queue.csv`.
3. Run **`make queue:validate`** — must pass.
4. Update GitHub: run **`make queue:pr-merge`** (or merge in the GitHub UI). Optional: **`PR_NUMBER=<n> make queue:pr-merge`** if not on the PR branch.
5. Run **`make queue:top-item`** — verify the next item JSON (or `make queue:peek` for raw CSV).

## 5.6.6 Expected Artifacts / Outputs

Row in `queuearchive.csv` with all fields. Row removed from `queue.csv`. `make queue:validate` passing. PR merged on GitHub and head branch deleted (or merged via UI).

## 5.6.7 Validation Checks

- [ ] Row in queuearchive.csv with status=done, completed_date, PR URL in notes
- [ ] Row removed from queue.csv
- [ ] make queue:validate passes
- [ ] PR merged on GitHub (queue:pr-merge or UI)

## 5.6.8 Rollback or Failure Handling

If `queue:validate` fails after archiving: fix CSV/schema and re-run. If **`queue:pr-merge`** fails after archive: the row is already archived — fix the PR/branch issue (permissions, conflicts) and merge via UI or re-run `make queue:pr-merge` when unblocked.

## 5.6.9 Handoff Expectations

Queue archived and validated; GitHub updated. Next queue item visible at top of `queue.csv`.
