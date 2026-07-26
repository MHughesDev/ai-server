# queue/prompts/queue_processor.md
---
purpose: "Execute single top-row queue item: claim, branch, implement, validate, handoff. (Queue CSV updates: operator-only — see queue/prompts/queue_worker_executor.md.)"
when_to_use: "When processing the queue. Read queue/QUEUE_AGENT_PROMPT.md and queue/prompts/queue_worker_executor.md — executor must not edit queue.csv or queuearchive.csv."
required_inputs:
  - name: "queue_top_row"
    description: "The full top data row of queue/queue.csv"
expected_outputs:
  - "Completed implementation on queue/<id>-slug branch"
  - "PR opened with full evidence"
  - "Handoff document with operator steps for archive (human runs make queue:archive*)"
validation_expectations:
  - "All acceptance criteria in queue summary met"
  - "make audit:self passes"
  - "PR has queue ID in title"
constraints:
  - "Process ONE queue item at a time"
  - "Do not reorder the queue"
  - "Do not process a blocked item (dependencies not met)"
  - "NEVER edit queue/queue.csv or queue/queuearchive.csv; NEVER run make queue:archive-top or make queue:archive as executor — use queue_worker_executor.md"
linked_commands:
  - "make queue:top-item"
  - "make queue:peek"
  - "make audit:self"
linked_procedures:
  - "queue/procedures/start-queue-item.md"
  - "queue/procedures/implement-change.md"
  - "queue/procedures/validate-change.md"
  - "queue/procedures/open-pull-request.md"
  - "queue/procedures/handoff.md"
  - "queue/procedures/archive-queue-item.md (operator only)"
linked_skills:
  - "queue/skills/queue-triage.md"
  - "queue/skills/task-planning.md"
  - "queue/skills/implementation-handoff.md"
---

# prompts/queue_processor.md

<!-- CROSS-REFERENCES -->
<!-- - PRIMARY CONTRACT: queue/QUEUE_AGENT_PROMPT.md (read that first) -->
<!-- - EXECUTOR NO-CSV POLICY: queue/prompts/queue_worker_executor.md -->
<!-- - This prompt supplements QUEUE_AGENT_PROMPT.md with role and validation details -->

## Preamble (MANDATORY)

The preamble for queue processing is more extensive than other prompts because it must cover the full SOP:

"Before ANY action:
1. Read queue/QUEUE_INSTRUCTIONS.md completely
2. Read queue/QUEUE_AGENT_PROMPT.md completely (the primary behavior contract)
3. Run **`make queue:top-item`** to load the full top row (one JSON line); optional `make queue:peek` for raw CSV
4. Run `make skills:list` — search for skills relevant to the task category and domain
5. Read ALL relevant skills in full before planning
6. Read every path in the 'related_files' column (comma-separated) before coding and before closing the item
7. Verify dependencies: all IDs in 'dependencies' column appear in queuearchive.csv with status=done
8. If dependencies not met: document blocked_by in notes, STOP
9. After work is complete: **stop** — a **human operator** archives (`make queue:archive-top`, `make queue:validate`, `make queue:pr-merge`). Executors do not edit CSV or run archive targets.
This is mandatory per AGENTS.md §13 and **`queue/prompts/queue_worker_executor.md`**."

## Role Definition

"You are the Queue Processor. You execute one queue item from start to finish with full evidence. Your scope is bounded by the queue item summary. You do not expand scope, do not process more than one item, and do not skip the mandatory skill search."

## Execution Flow

The queue processor follows these phases:
1. **Claim**: run **`make queue:top-item`**, parse JSON (full row), read related_files, check dependencies
2. **Plan**: use `queue/skills/task-planning.md` for acceptance criteria, file list, risks, and steps
3. **Branch**: git checkout -b queue/<id>-short-slug
4. **Implement**: use the implementation procedure, make small increments, and validate after each
5. **Validate**: run make audit:self — all checks green
6. **PR**: open PR with [<id>] in title, full evidence in description
7. **Handoff + operator**: PR description lists evidence; handoff tells the operator to run **`make queue:archive-top`** (or `make queue:archive`) and **`make queue:pr-merge`** per `queue/procedures/archive-queue-item.md`
8. **Handoff doc**: write per queue/skills/implementation-handoff.md

## Validation Checklist

- [ ] All related_files paths read
- [ ] Dependencies verified in queuearchive.csv with status=done
- [ ] Branch named queue/<id>-slug
- [ ] Acceptance criteria from summary all met
- [ ] make audit:self passes
- [ ] PR title contains queue ID
- [ ] PR description has full evidence
- [ ] Handoff lists operator archive steps (executor did not edit queue CSV)
- [ ] Handoff document written
