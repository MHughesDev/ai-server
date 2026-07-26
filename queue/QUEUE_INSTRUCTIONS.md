# queue/QUEUE_INSTRUCTIONS.md

<!-- CROSS-REFERENCES -->
<!-- - Referenced by: AGENTS.md §9, CONTRIBUTING.md, queue/QUEUE_AGENT_PROMPT.md -->
<!-- - Related skills: queue/skills/queue-triage.md, queue/skills/queue-intelligence.md -->

**Purpose:** Human and agent SOP for all queue operations. Canonical reference for queue lifecycle, branch naming, PR linking, conflict resolution. Per spec §26.6 item 192.

## Overview

One paragraph. This file is the authoritative SOP for the CSV-based agent work queue. Any agent working on queue items must read this file completely before starting. The queue is NOT a product backlog — it is an agent work orchestration lane with strict lifecycle rules.

## File Roles

Description of each queue file and its role:
- `queue/queue.csv` — Open items; top data row = active work item for single-lane processing
- `queue/queuearchive.csv` — Historical record; append-only; completed/cancelled/superseded items
- `queue/QUEUE_AGENT_PROMPT.md` — Executable behavior contract for agents (must read before processing)
- `queue/queue.lock` — Optional mutex file; present = someone is actively processing
- `queue/audit.log` — Append-only JSON lines for all claim/release/archive events

## Schema (Column Definitions)

Table defining each column in queue.csv:
| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | string | yes | Unique identifier (e.g., Q-001). Never reuse IDs. |
| batch | string | no | Batch label for coordinated release trains (e.g., "1-mvp") |
| phase | string | no | Phase within batch for ordering (e.g., "1", "2") |
| category | string | yes | Work category — must be in queue/docs/queue-categories.md |
| summary | string | yes | Elaborative work contract ≥100 chars. Must include: goal, acceptance criteria, definition of done, out-of-scope, dependencies |
| agent_instructions | string | no | Instructions for the **implementation executor** (see `queue/prompts/queue_worker_executor.md`): numbered steps for sequence, or bullets/prose if order-free. Empty if none. |
| constraints | string | no | Specific characteristics and implementation requirements that must be respected: UI/UX interaction behaviors, color hex codes, design system rules, API contracts, naming conventions, or any non-negotiable quality/style properties. Think of these as "characteristics" of the work. |
| dependencies | string | no | Comma-separated IDs of items that must be done before this one |
| related_files | string | no | Comma-separated repo-relative paths (code and docs) the agent MUST read before completing the item; use quoted CSV fields if paths contain commas |
| notes | string | no | Operator notes: blockers, in-progress branch, PR URLs, completion info (executors do not edit) |
| created_date | date | yes | ISO 8601 date (YYYY-MM-DD) |

Archive-only columns:
| status | string | yes | "done", "cancelled", or "superseded" |
| completed_date | date | yes | ISO 8601 date when archived |

## Lifecycle State Machine

State transitions per spec §17.3. Each state with location, transition rules, and notes requirements:
- **Open** → In Progress: agent creates branch named queue/<id>-slug
- **In Progress** → Done: work complete; agent archives with status=done, completed_date, PR URL, then runs **`make queue:pr-merge`** (or merges in UI) to update GitHub
- **In Progress** → Blocked: agent updates notes with blocker; stays in queue.csv
- **Blocked** → In Progress: blocker resolved; agent updates notes, resumes
- **Open/In Progress** → Cancelled: human decision; archive with status=cancelled
- **Open** → Superseded: newer item covers the same scope; archive with status=superseded + successor ID

## Single-Lane Processing Rules

Rules for single-lane processing:
1. Only ONE item may be "In Progress" at a time under the default policy
2. The top data row of queue.csv is the next item to process
3. Before starting: verify all dependencies are in queuearchive.csv with status=done
4. Blocked top item: document blocker in notes; optionally process next ready item
5. Never reorder queue.csv rows without human approval

## Claiming Work

How to claim a queue item:
1. Run **`make queue:top-item`** — stdout is **one line** of JSON with the full top row (all columns). Parse it; **`summary`** is the contract. Optional: `make queue:peek` for raw CSV (header + first data row).
2. Verify dependencies met (all IDs in queuearchive.csv with status=done)
3. Read every path in `related_files` (split on commas; trim whitespace) before implementation and again before PR/handoff — treat as mandatory context alongside the summary. Read **`agent_instructions`** (if non-empty) and follow it together with the summary.
4. Create branch: `git checkout -b queue/<id>-short-slug`
5. Update notes column (optional but recommended): "in_progress | branch: queue/<id>-slug"
6. Run mandatory skill search before starting implementation

## Branch Naming

Branch naming convention: `queue/<id>-short-slug`
- id: the exact value from the id column (e.g., Q-001)
- short-slug: 3-5 words, kebab-case, describing the work (e.g., add-invoice-endpoint)
- Full example: `queue/Q-001-add-invoice-endpoint`
- Alternative (cursor-initiated): `cursor/<descriptive-slug>-<suffix>`

## PR Linking

Every queue-driven PR must:
- Include the queue ID in the PR title: `[Q-001] type(scope): description`
- Paste the PR URL in the queue item's notes column
- After CI/review and the work is complete: **archive the item** (see Archiving), **`make queue:validate`**, then update GitHub with **`make queue:pr-merge`** (`gh pr merge --merge --delete-branch`) or merge in the UI

## Blocked Items

Protocol for blocked items (do NOT archive):
- Update notes: `blocked_by: <reason> | owner: <who> | next_step: <what triggers unblocking>`
- Create escalation (GitHub issue or comment on relevant PR)
- Item stays at its position in queue.csv
- After unblocking: update notes, resume processing

## Archiving

How to archive a completed item (then update GitHub):
1. **Token-friendly (recommended for single-lane):** run **`make queue:archive-top`** — moves the **first data row** in `queue.csv` to `queuearchive.csv` with `status=done` and today's `completed_date`. No queue id in the command; use when the top row is the item you are closing.
2. Or run `make queue:archive QUEUE_ID=<id>` (scripted) or manually:
   - Copy row to queuearchive.csv
   - Add: status=done, completed_date=YYYY-MM-DD, PR URL in notes
   - Remove from queue.csv
3. Run **`make queue:validate`** — must pass
4. **Update GitHub last:** from the PR branch run **`make queue:pr-merge`** — `gh pr merge --merge --delete-branch` — or merge in the GitHub UI. Optional: `PR_NUMBER=<n> make queue:pr-merge` if not on the PR branch. Then update local `main` if needed (`git checkout main && git pull`).

**Warning:** `queue:archive-top` archives by **position**, not by id. Only use when the top open row is the item you intend to close (default single-lane policy).

## Batch/Phase Policy

Batch semantics: items with the same batch value are released as a coordinated unit. Phase within batch determines ordering. Processors MAY process items in strict FIFO within a batch. If batch policy is active: document in queue notes.

## Conflict Resolution

If two processors collide on queue.csv:
1. Stop immediately
2. Re-run `make queue:validate` on both copies
3. Use `main` branch as the truth
4. Merge manually: never silently drop rows
5. Verify no duplicate IDs after merge

## Validation

Run `make queue:validate` after any modification. Validation checks:
- Header row matches expected columns
- No duplicate IDs across queue.csv and queuearchive.csv
- All categories in queue/docs/queue-categories.md
- Summary length ≥100 chars
- No circular dependencies
