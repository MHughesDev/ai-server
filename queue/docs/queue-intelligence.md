---
doc_id: "12.2"
title: "queue intelligence"
section: "Queue"
summary: "Conceptual documentation for the queue intelligence layer: DAG, complexity, batching, conflict detection."
updated: "2026-04-17"
---

# 12.2 — queue intelligence

<!-- CROSS-REFERENCES -->
<!-- - Per spec §17.11 and §26.12 item 355 -->
<!-- - Machinery: queue/skills/queue-intelligence.py -->

**Purpose:** Conceptual documentation for the queue intelligence layer: DAG, complexity, batching, conflict detection. Per spec §17.11.

## 12.2.1 Overview

One paragraph. The intelligence layer extends the queue beyond naive FIFO with dependency-aware ordering, complexity estimation, batch suggestions, and conflict detection. It informs human decisions without auto-editing the CSV.

## 12.2.2 Dependency Graph Resolution (§17.11.1)

How the DAG is built from the dependencies column. How readiness is determined (all deps in archive with status=done). Cycle detection. The make queue:graph output format (Mermaid).

## 12.2.3 Complexity Estimation (§17.11.2)

How advisory complexity scores (S/M/L/XL or 1-10) are derived: summary keyword analysis, git history, transitive dependency depth, category heuristics. Advisory only — does not reorder CSV.

## 12.2.4 Automatic Batching (§17.11.3)

How batch suggestions are made: same module context, shared prerequisites, schema+API pairs, test+implementation pairs. Humans confirm by setting the same batch value — system does not auto-edit.

## 12.2.5 Conflict Detection (§17.11.4)

How file overlap is detected across open items: paths are extracted from each item’s **`summary`** and **`related_files`** columns (in addition to dependency edges). How merge conflict risk is flagged. Ordering suggestions (fewer shared files second).

## 12.2.6 Using the Intelligence Tools

Step-by-step guide for human maintainers:
1. make queue:graph → review dependency visualization
2. make queue:analyze → read batch and conflict suggestions
3. Review and manually set batch values in queue.csv based on suggestions
4. Agents then process items in batch order
