# queue/skills/queue-intelligence.md

<!-- CROSS-REFERENCES -->
<!-- - Machinery: queue/skills/queue-intelligence.py -->
<!-- - Conceptual docs: queue/docs/queue-intelligence.md -->
<!-- - Make targets: make queue:graph, make queue:analyze -->
<!-- - Scripts: queue/scripts/queue-graph.sh, queue/scripts/queue-analyze.sh -->

**Purpose:** [FULL SKILL] How to invoke and interpret the queue intelligence system: dependency DAG, complexity estimation, batch suggestions, and conflict detection. Per spec §17.11 and §26.12 items 351-355.

## Purpose

One paragraph. The queue intelligence layer goes beyond naive FIFO ordering to provide dependency-aware, complexity-informed orchestration. It detects circular dependencies, suggests batch groupings, identifies conflict risks between concurrent items, and estimates complexity — without reordering the CSV. Human maintainers make ordering decisions; the system informs them.

## When to Invoke

- Before starting a new batch of queue items (weekly or per sprint)
- When the queue has grown to 10+ items and dependencies are complex
- When two agents might work concurrently (conflict detection)
- When a new item is added and its batch assignment is unclear
- When `make queue:validate` reports circular dependencies

## Prerequisites

- `queue/queue.csv` and `queue/queuearchive.csv` exist and are valid
- `make queue:validate` passes
- Python 3.12+ with networkx package available (for DAG operations)
- Git history accessible (for complexity heuristics)

## Relevant Files/Areas

- `queue/skills/queue-intelligence.py` — the intelligence engine (mandatory read before using)
- `queue/scripts/queue-graph.sh` → `make queue:graph` — visualize the dependency DAG
- `queue/scripts/queue-analyze.sh` → `make queue:analyze` — full analysis report
- `queue/docs/queue-intelligence.md` — conceptual documentation
- `queue/queue.csv` — source data for analysis

## Step-by-Step Method

Numbered steps:
1. Run `make queue:validate` — verify queue is parseable before analysis
2. Run `make queue:graph` — visualize the dependency DAG
   - Output: Mermaid graph or text adjacency list
   - Look for: cycles (validation should catch these), long chains, isolated items
3. Run `make queue:analyze` — full intelligence report
   - Section 1: Dependency readiness (which items are ready, which are blocked)
   - Section 2: Complexity estimates (S/M/L/XL per item)
   - Section 3: Batch suggestions (items that share context/module)
   - Section 4: Conflict risk (items that may touch the same files)
4. Use the analysis to:
   - Mark ready vs. blocked items
   - Assign batch values to suggested groups
   - Note conflict risks in queue notes
5. Never auto-edit the CSV based on analysis — human confirms changes

## Command Examples

- `make queue:graph` — render dependency graph
- `make queue:analyze` — full analysis report
- `make queue:validate` — verify no circular dependencies
- `python queue/skills/queue-intelligence.py graph --repo-root .` — graph only
- `python queue/skills/queue-intelligence.py analyze --repo-root .` — analysis only

## Validation Checklist

- [ ] No circular dependencies (make queue:validate passes)
- [ ] Blocked items identified and their blockers noted
- [ ] Batch suggestions reviewed by human maintainer
- [ ] Conflict risks documented in queue notes for affected items
- [ ] Complexity estimates captured for planning purposes

## Common Failure Modes

- **Circular dependency**: two items depend on each other → `make queue:validate` exits non-zero. Fix: review the dependency column, break the cycle by reordering or removing one dependency.
- **Missing archive entry**: dependency ID referenced that doesn't exist in queue or archive → analysis reports "unknown dependency". Fix: verify the ID is correct.
- **Stale complexity estimate**: git history-based estimates become stale as the codebase changes → re-run `make queue:analyze` weekly.

## Handoff Expectations

After running queue intelligence:
- Attach the analysis report to the batch planning PR or queue notes
- Document which items are ready vs blocked
- Document any conflict risk warnings

## Related Procedures

queue/procedures/start-queue-item.md, queue/procedures/add-queue-category.md

## Related Prompts

queue/prompts/queue_processor.md

## Related Rules

.cursor/rules/queue.md (queue invariants and dependency checking)

## Machinery

`queue/skills/queue-intelligence.py` — the intelligence engine. See that file's docstring for full API. Key functions:
- `build_dag(queue, archive)` — build dependency directed acyclic graph
- `find_ready_items(dag, archive)` — items with all deps satisfied
- `detect_conflicts(queue)` — items with overlapping file sets
- `suggest_batches(queue)` — group by module/context
- `estimate_complexity(item, git_history)` — S/M/L/XL estimate

Invoked by: `queue/scripts/queue-graph.sh` (graph mode) and `queue/scripts/queue-analyze.sh` (analyze mode).
