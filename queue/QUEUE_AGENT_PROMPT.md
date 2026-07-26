# queue/QUEUE_AGENT_PROMPT.md

<!-- CROSS-REFERENCES -->
<!-- - Read by: agents processing queue items (injected as context) -->
<!-- - Referenced by: queue/QUEUE_INSTRUCTIONS.md, queue/prompts/queue_processor.md -->
<!-- - Per spec §26.6 item 193 -->

**Purpose:** Executable behavior contract for agents processing queue work. Injected as context when an agent processes queue items. Per spec §2 and §26.6 item 193.

## Role Definition

State the agent's role and authority scope: "You are processing a queue item from queue/queue.csv. Your authority is bounded by the queue item's summary — you implement exactly what the summary describes, no more, no less. You are not authorized to silently expand scope or skip the mandatory skill search."

### Executor vs operator (CSV is operator-only)

**Implementation agents (executors)** MUST **read** `queue/queue.csv` and `queue/queuearchive.csv` only as needed (e.g. dependency checks). They MUST **never** create, edit, delete, or move rows in those files — including via `make queue:archive-top`, `make queue:archive`, shell redirection, or patch tools. Use **`queue/prompts/queue_worker_executor.md`** as the canonical executor contract.

**Human operators** (or dedicated non-executor automation) perform queue ledger updates: `notes`, **`make queue:archive-top`**, **`make queue:archive`**, **`make queue:validate`** after CSV changes, and **`make queue:pr-merge`**. Executors put the PR URL and evidence in the **PR body** and **handoff**; operators paste into CSV if required.

## Required Read Order

Ordered list of what must be read before processing begins:
1. This file (QUEUE_AGENT_PROMPT.md) — complete
2. queue/QUEUE_INSTRUCTIONS.md — complete
3. Run **`make queue:top-item`** — stdout is one JSON line with **every column** of the top open row; parse it completely
4. **`agent_instructions` column** — if non-empty, treat as ordered or unordered steps for the executor; follow together with the **summary** (summary remains the primary contract).
5. **`constraints` column** — if non-empty, contains non-negotiable implementation characteristics (UI/UX interaction behaviors, hex color codes, API contracts, naming conventions, etc.); MUST be respected throughout implementation.
6. **related_files column** — every comma-separated path (repo-relative); read each file or directory before coding and before marking the item complete
7. All files/docs referenced in the summary column (if not already covered by related_files)
8. Skills (mandatory search — see below)

## MANDATORY SKILL SEARCH (Non-Negotiable)

Per spec §4.1 item 13 and AGENTS.md §13 — this step is mandatory and non-negotiable.

Before planning or writing any code:
1. Identify the task domain from the summary (backend, security, testing, infrastructure, etc.)
2. Run `make skills:list` OR read queue/skills/README.md
3. Scan the "When to invoke" section of ALL skills in the relevant category
4. Read every HIGH-relevance skill in FULL before proceeding
5. Note machinery (.py files) as available automation tools
6. Document which skills were found in your handoff notes

**An agent that skips this step is operating out of policy. Stop and complete this step.**

## Execution Rules

Numbered rules for queue item execution:
1. Process ONE item at a time — never start a second item until the first is archived
2. Read the COMPLETE **summary** and non-empty **agent_instructions** — together they form the work contract; partial reads cause scope failures
3. Verify ALL dependencies in queuearchive.csv with status=done before starting
4. If any dependency not met: document in notes as `blocked_by:`, STOP, do not start
5. Plan before coding: acceptance criteria, file impact, risks, scope bounds
6. Validate after each increment: `make lint && make test`
7. Full validation before PR: `make audit:self`
8. STOP and escalate if security or tenancy semantics are ambiguous

## Branch Naming

Required format: `queue/<id>-short-slug` where id is the exact value from the id column. Example: `queue/Q-001-add-invoice-endpoint`.

## PR Requirements

Every PR must have:
- Queue ID in title: `[Q-001] feat(invoices): implement invoice CRUD endpoints`
- Evidence in description: files changed, commands run with output, acceptance criteria met
- All CI checks green
- PR URL pasted into queue item notes before or during archiving

## Archive Procedure (operator — not the implementation executor)

After CI is green and the PR is approved per policy, a **human operator** (not the coding executor agent) archives the row:

1. Prefer **`make queue:archive-top`** — archives the first open row when it matches the completed item.
2. Or **`make queue:archive QUEUE_ID=<id>`** for a specific id.
3. Verify **`queuearchive.csv`**: status=done, completed_date=YYYY-MM-DD, PR URL in notes as needed.
4. Run **`make queue:validate`**
5. Confirm **`queue.csv`** no longer contains this row
6. **GitHub:** **`make queue:pr-merge`** or merge in the UI.

**Executors** do not run archive commands and do not edit CSV files — they deliver the PR and handoff only.

## Blocked Handling

If blocked during work:
1. **Executors** document `blocked_by` in **PR description, issue, or handoff** — not by editing **`queue.csv`** unless policy explicitly designates you as operator.
2. **Operators** may copy that text into **`notes`** when they update the CSV.
3. Leave item in queue.csv (do NOT archive until unblocked)
4. Create GitHub issue or escalation
5. Write partial handoff document

## Evidence Requirements

Every queue item completion requires:
- Handoff document (per queue/procedures/handoff.md)
- In PR description: files changed list + commands run + acceptance criteria verification
- In queue notes: PR URL + completion date
- In queuearchive.csv: full row with status=done
