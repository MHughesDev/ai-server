---
doc_id: "12.3"
title: "queue system overview"
section: "Queue"
summary: "Queue system conceptual overview: purpose, lifecycle, single-lane semantics, tooling."
updated: "2026-04-17"
---

# 12.3 — queue system overview

<!-- CROSS-REFERENCES -->
<!-- - Referenced by: queue/QUEUE_INSTRUCTIONS.md, docs/README.md -->
<!-- - Per spec §26.5 item 187 and §17 -->

**Purpose:** Queue system conceptual overview: purpose, lifecycle, single-lane semantics, tooling. Per spec §17 and §26.5 item 187.

## 12.3.1 Purpose

One paragraph. The queue is the agent work orchestration lane — NOT a product backlog or PM system. It coordinates agent execution in a controlled, auditable way with strict lifecycle rules that prevent work from being dropped or duplicated.

## 12.3.2 File Roles

Table explaining each queue file:
- queue/queue.csv — Open items; top row = active work item for single-lane processing. Each row includes **`related_files`**: comma-separated repo paths agents must read before completing the item.
- queue/queuearchive.csv — Historical record; append-only; completed/cancelled/superseded
- queue/QUEUE_INSTRUCTIONS.md — Human + agent SOP for all queue operations
- queue/QUEUE_AGENT_PROMPT.md — Executable behavior contract for agents processing queue items
- queue/queue.lock — Optional mutex preventing concurrent processing
- queue/audit.log — Append-only JSON lines for all queue operations

## 12.3.3 Single-Lane Semantics

Explanation of the single-lane model: at most one processor claims the top row at a time. Top row = active item. Processors read the entire row and treat summary as the contract. Why: coordination between agents without complex locking.

## 12.3.4 Lifecycle States

Table per spec §17.3:
| State | Location | Transition Rules |
|-------|----------|-----------------|
| Open | queue.csv | Top row = next item |
| In Progress | queue.csv (notes column with branch info) | Document branch in notes |
| Blocked | queue.csv | Notes must explain blocker, owner, next step |
| Done | queuearchive.csv | Moved with status=done, completed_date, PR URL |
| Cancelled | queuearchive.csv | status=cancelled, reason in notes |
| Superseded | queuearchive.csv | status=superseded, successor ID in notes |

## 12.3.5 Branch Naming

Pattern: `queue/<id>-short-slug`. The queue ID is mandatory. PR must reference queue ID in title or body.

## 12.3.6 Queue Intelligence

Brief overview of the intelligence layer (§17.11): dependency DAG, complexity estimates, batch suggestions, conflict detection. Links to queue/docs/queue-intelligence.md for full conceptual docs.

## 12.3.7 Tooling

Table of queue-related make targets and their purpose:
- make queue:top-item — First open row as **one JSON line** (all columns; agents use this first)
- make queue:peek — Raw CSV: header + first row (read-only)
- make queue:validate — Schema + invariants
- make queue:archive — Move a row by id from open to archive
- make queue:archive-top — Move the **top** open row to archive (no id; token-friendly for single-lane)
- make queue:graph — Visualize dependency DAG
- make queue:analyze — Full queue intelligence analysis
