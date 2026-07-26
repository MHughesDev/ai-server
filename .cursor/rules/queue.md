---
globs:
  - "queue/**"
description: Queue file invariants. Lifecycle rules, schema enforcement, no row deletion without archive.
---

# .cursor/rules/queue.md

Invariants for **`queue/queue.csv`** and **`queue/queuearchive.csv`**. Canonical SOP: **`queue/QUEUE_INSTRUCTIONS.md`**. Validate with **`make queue:validate`**.

## Schema

1. **`queue.csv`** header (order): **`id,batch,phase,category,summary,agent_instructions,constraints,dependencies,related_files,notes,created_date`** (adjust only if **`queue-validate`** and docs agree).
2. **`queuearchive.csv`** includes the same columns **plus** **`status`** and **`completed_date`**.
3. **`id`**: unique; prefer stable IDs such as **`Q-001`**.
4. **`category`**: must match **`queue/docs/queue-categories.md`**.
5. **`summary`**: long enough to be a **contract** (goal, acceptance criteria, done definition) — typically **≥ 100 characters** when enforced by tooling.
6. **`dependencies`**: comma-separated queue **`id`** values or empty.
7. **`constraints`**: specific characteristics and non-negotiable implementation requirements — UI/UX interaction behaviors, hex color codes, design system rules, API contracts, naming conventions. Agents MUST respect these when implementing.
8. **`related_files`**: comma-separated repo-relative paths; agents MUST read these before completing the item (quote the field in CSV if paths contain commas).
9. **`notes`**: blockers, PR URLs, completion metadata — never delete history casually.

## Lifecycle

1. Active work is represented by the **top data row** in **`queue.csv`** for single-lane operation (see SOP).
2. **Blocked** rows stay in **`queue.csv`** with explicit **`notes`**.
3. **Done / cancelled / superseded** rows move to **`queuearchive.csv`** with **`status`** and dates — **append-only** archive.
4. Never **delete** a row without an archived copy when the lifecycle requires retention.

## Executor agents (implementation)

Agents implementing queue items MUST follow **`queue/prompts/queue_worker_executor.md`**: **read** `QUEUE_INSTRUCTIONS.md` and `QUEUE_AGENT_PROMPT.md`, use **`make queue:top-item`**, **never** edit **`queue.csv`** or **`queuearchive.csv`**, **never** run **`make queue:archive-top`** / **`make queue:archive`**. **Human operators** (or designated automation) perform CSV updates and archive commands.

## Branches and PRs

1. Queue work branches: **`queue/<id>-short-slug`** including the **`id`**.
2. PR title/body references the queue **`id`** and links to the row when possible.
3. Close the item in CSV first: **`make queue:archive-top`** or **`make queue:archive`**, then **`make queue:validate`**. Then update GitHub: **`make queue:pr-merge`** (requires **`gh`**) — merge PR and delete remote head branch.

## Summary quality

Agents treat **`summary`** as the contract. If it is ambiguous, **stop** and ask for clarification rather than guessing.
