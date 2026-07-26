# queue/prompts/queue_worker_executor.md

---
purpose: "Execute the top queue item’s implementation work only: read contracts, branch, code, PR, hand off — never edit queue CSV files."
when_to_use: "Whenever an agent processes queue-driven work under the executor policy (single canonical queue worker role)."
required_inputs:
  - name: "top_item_json"
    description: "Output of make queue:top-item (one JSON line) after reading QUEUE_INSTRUCTIONS.md and QUEUE_AGENT_PROMPT.md"
expected_outputs:
  - "Branch queue/<id>-slug with implementation"
  - "PR with [Q-xxx] in title and full evidence"
  - "Handoff telling a human operator how to update queue state (no CSV edits by this agent)"
validation_expectations:
  - "queue/queue.csv and queue/queuearchive.csv were not modified by this agent (no write tools, no make queue:archive*, no queue:validate that implies CSV write by agent)"
  - "make queue:top-item was run; summary contract satisfied"
constraints:
  - "NEVER edit, create, patch, or delete queue/queue.csv or queue/queuearchive.csv — including via shell redirection, heredocs, or make queue:archive-top / make queue:archive / manual rows"
  - "NEVER run make queue:validate if the only intent is to mutate queue CSV as part of this role (operator runs validate after they change CSV)"
  - "Read queue/QUEUE_INSTRUCTIONS.md and queue/QUEUE_AGENT_PROMPT.md completely before any implementation"
linked_commands:
  - "make queue:top-item"
  - "make queue:peek"
  - "make lint"
  - "make test"
  - "make audit:self"
linked_procedures:
  - "queue/QUEUE_INSTRUCTIONS.md"
  - "queue/QUEUE_AGENT_PROMPT.md"
  - "queue/procedures/start-queue-item.md"
  - "queue/procedures/implement-change.md"
  - "queue/procedures/open-pull-request.md"
  - "queue/procedures/handoff.md"
linked_skills:
  - "queue/skills/queue-triage.md"
  - "queue/skills/task-planning.md"
---

## Queue Worker Executor (canonical queue agent)

You are the **only** agent role that should run queue implementation work. Your job is **not** to maintain the queue ledger.

## Absolute prohibitions (non-negotiable)

1. **Do not touch** `queue/queue.csv` or `queue/queuearchive.csv` in any way:
   - No editor patches, no `write`, no `search_replace`, no `echo >>`, no Python one-liners writing those paths.
2. **Do not run** `make queue:archive-top`, `make queue:archive`, or any target whose purpose is moving or editing queue rows **as this agent**. Queue lifecycle is **human-operator** (or separate automation outside this role).
3. **Do not** paste PR URLs into queue **notes** yourself — put the PR URL in the **PR description** and **handoff**; the operator updates CSV if your process requires it.

## Required read order (before coding)

1. **`queue/QUEUE_INSTRUCTIONS.md`** — complete (understand lifecycle even though you do not execute CSV steps).
2. **`queue/QUEUE_AGENT_PROMPT.md`** — complete (respect skill search, branch naming, PR title — except CSV/archive steps delegated to operator).
3. **`make queue:top-item`** — parse the one JSON line; **`summary`** is the primary contract; **`agent_instructions`** (if non-empty) adds ordered or unordered steps — follow both; **`constraints`** (if non-empty) lists non-negotiable implementation characteristics (UI behaviors, color codes, API contracts, etc.) that must be respected throughout.
4. **`related_files`** — read every path before and after implementation.
5. **Mandatory skill search** — `make skills:list` / `queue/skills/README.md`; read relevant skills in full.

## Execution flow

1. Verify **dependencies** by reading `queue/queuearchive.csv` **read-only** (or operator confirmation): required IDs must have `status=done`. If blocked: **stop**; document `blocked_by` in **PR draft or handoff**, not in CSV.
2. `git checkout -b queue/<id>-short-slug`
3. Implement, validate (`make lint`, `make test`, `make audit:self` as appropriate).
4. Open PR: title `[<id>] ...`; body = evidence + acceptance criteria + **operator checklist** (below).
5. **Handoff** per `queue/procedures/handoff.md`: include PR URL, branch name, and text the operator can paste into **notes** if they choose.

## Operator checklist (for humans — not executed by this agent)

After CI is green and the PR is ready to merge:

- Merge PR (or approve merge).
- Run **`make queue:archive-top`** or **`make queue:archive QUEUE_ID=<id>`** as appropriate.
- Run **`make queue:validate`**.
- Run **`make queue:pr-merge`** if using GitHub CLI per `queue/QUEUE_INSTRUCTIONS.md`.

## Validation checklist (this agent)

- [ ] Read `QUEUE_INSTRUCTIONS.md` and `QUEUE_AGENT_PROMPT.md`
- [ ] Ran `make queue:top-item` and parsed JSON (including `agent_instructions` and `constraints` if present)
- [ ] Skill search completed
- [ ] Branch `queue/<id>-...`
- [ ] No files under `queue/` modified except **read** of markdown instructions (and read-only peek at CSV if needed for dependencies)
- [ ] PR + handoff complete
