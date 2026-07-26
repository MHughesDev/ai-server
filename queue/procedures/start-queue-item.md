---
doc_id: "5.21"
title: "start queue item"
section: "Procedures"
summary: "SOP: Claim top queue row, create branch, read relevant docs."
updated: "2026-04-17"
---

# 5.21 — start queue item

<!-- CROSS-REFERENCES -->
<!-- - Referenced by: AGENTS.md §9, queue/prompts/queue_processor.md -->
<!-- - Skill: queue/skills/queue-triage.md -->

**Purpose:** SOP: Claim top queue row, create branch, read relevant docs. Per spec §26.5 item 139 and §8.3.

## 5.21.1 Purpose

Correctly starting a queue item prevents the most common failure modes: starting blocked work, missing acceptance criteria, or skipping the mandatory skill search.

## 5.21.2 Trigger / When to Use

When ready to begin processing the next queue item. After any previous item is archived or when assigned to queue processing.

## 5.21.3 Prerequisites

queue/QUEUE_INSTRUCTIONS.md read. Previous queue item archived (or confirmed none). make queue:validate passes.

## 5.21.4 Exact Commands

`make queue:top-item`, `make queue:validate`, `make skills:list`, `git checkout -b queue/<id>-slug`

## 5.21.5 Ordered Steps

1. Run **`make queue:top-item`** — read the JSON line (full top row; all columns). Use `make queue:peek` if you need raw CSV lines.
2. Read the COMPLETE summary column — this is the work contract; do not skip
3. Parse the `dependencies` column — check each ID against queuearchive.csv
4. Parse the `related_files` column — read every comma-separated path (mandatory pre-read before implementation)
5. Run `make queue:validate` — verify queue schema before starting
6. If any dependency not in archive with status=done: update notes with `blocked_by: [IDs]` and STOP (see handle-blocked-work.md)
7. Run `make skills:list` — identify relevant skills for the task domain
8. Read ALL relevant skills in full
9. Read all files referenced in the summary (if not already covered by `related_files`)
10. Create branch: `git checkout -b queue/<id>-short-slug`
11. Document understanding: list acceptance criteria, files to change, risks
12. Store plan in PR description draft or queue notes

## 5.21.6 Expected Artifacts / Outputs

Branch created with correct naming. Plan documented. Relevant skills read and noted.

## 5.21.7 Validation Checks

- [ ] Top item read completely
- [ ] Dependencies verified in queuearchive.csv
- [ ] Every path in `related_files` read (or directory listing understood)
- [ ] Mandatory skill search completed
- [ ] Branch named queue/<id>-slug
- [ ] Plan documented

## 5.21.8 Rollback or Failure Handling

If blocked: follow your repo's blocked-work procedure. Do not start implementation on a blocked item.

## 5.21.9 Handoff Expectations

Branch created, plan documented, ready to begin implementation.
