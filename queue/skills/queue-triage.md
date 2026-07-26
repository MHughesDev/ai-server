# queue/skills/queue-triage.md

<!-- CROSS-REFERENCES -->
<!-- - Machinery: queue/skills/queue-triage.py -->
<!-- - Related procedure: queue/procedures/start-queue-item.md -->
<!-- - Related prompt: queue/prompts/queue_processor.md -->

**Purpose:** [FULL SKILL] How to read, interpret, and prioritize queue items. Covers reading queue.csv, understanding the summary contract, checking dependencies, and deciding readiness. Per spec §26.4 item 40.

## Purpose

One paragraph describing what this skill enables. State: This skill enables an agent to correctly interpret the queue state, identify the next ready item, check dependency readiness, and assess item quality (summary completeness, category validity). Use this skill every time you process the queue.

## When to Invoke

Specific triggers:
- Before claiming any queue item (mandatory)
- When the top item appears blocked and you need to find the next ready item
- When assessing the overall queue health
- Before running `make queue:analyze`

## Prerequisites

Required before starting:
- `queue/queue.csv` exists and is accessible
- `queue/queuearchive.csv` exists (for dependency checking)
- `make queue:validate` passes (queue schema valid)
- Python and pandas/csv module available for machinery

## Relevant Files/Areas

Files involved:
- `queue/queue.csv` — open items
- `queue/queuearchive.csv` — completed items (for dependency verification)
- `queue/QUEUE_INSTRUCTIONS.md` — full SOP
- `queue/scripts/queue_top_item.py` — JSON line for top row (`make queue:top-item`)
- `queue/scripts/queue-peek.sh` — raw CSV peek
- `queue/skills/queue-triage.py` — triage analyzer machinery

## Step-by-Step Method

Numbered steps:
1. Run **`make queue:top-item`** — parse the one-line JSON (full top row); or `make queue:peek` for raw CSV
2. Read the COMPLETE `summary` column — this is the work contract
3. Check `related_files` column: parse comma-separated repo paths; agents must read these before completing the item
4. Check `dependencies` column: parse comma-separated IDs
5. For each dependency ID: verify it exists in `queuearchive.csv` with `status=done`
6. If any dependency not met: item is NOT READY — document `blocked_by: [IDs]` in notes
7. Check `category` column: verify it is in the valid set from `queue/docs/queue-categories.md`
8. Check `summary` length ≥ 100 characters with goal, acceptance criteria, definition of done
9. Run `queue/skills/queue-triage.py` for automated triage report
10. If top item is not ready: identify the next ready item (scan remaining rows)
11. Document your triage decision in PR notes or queue notes

## Command Examples

Exact commands:
- **`make queue:top-item`** — full top row as one JSON line
- `make queue:peek` — raw header + first row
- `make queue:validate` — validate entire queue schema
- `make queue:analyze` — full intelligence analysis (deps, complexity)
- `python queue/skills/queue-triage.py` — automated triage report

## Validation Checklist

- [ ] Top item read completely (not just the first column)
- [ ] `related_files` paths noted (agents must read before completing the item)
- [ ] All dependencies verified in queuearchive.csv
- [ ] Summary quality assessed (≥100 chars, includes goal + criteria + done definition)
- [ ] Category is valid
- [ ] Triage decision documented

## Common Failure Modes

- **Dependencies not checked**: starting work on an item with unmet dependencies → causes conflicts and incomplete implementation. Fix: always check dependencies before branching.
- **Partial summary read**: reading only the first 50 chars of a long summary → misses acceptance criteria. Fix: read the ENTIRE summary column value.
- **Category typo**: category not in valid set → `make queue:validate` will catch but delays work. Fix: check `queue/docs/queue-categories.md` before adding rows.

## Handoff Expectations

What the next agent needs after triage:
- Clear statement of which item is being processed (ID + one-line summary)
- Confirmation of dependency readiness
- Triage report if multiple items were assessed
- Branch name for the item being processed

## Related Procedures

queue/procedures/start-queue-item.md

## Related Prompts

queue/prompts/queue_processor.md

## Related Rules

.cursor/rules/queue.md (queue invariants), AGENTS.md §9 (queue interaction rules)

## Machinery

`queue/skills/queue-triage.py` — reads queue.csv and queuearchive.csv, validates schema, checks dependencies, scores item readiness, outputs triage report. Invoked via: `python queue/skills/queue-triage.py` or `make queue:analyze` (as part of analysis).
