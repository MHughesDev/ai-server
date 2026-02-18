# 09 ResourceManager Spec

## Purpose
Translate policy max limits into effective per-request budgets and execution mode.

## Budgets
- deadline_ms
- token_budget
- tool_budget
- cost_budget_usd
- max_parallel_tools

## Controls
Per-tenant concurrency caps, queue admission, deadline propagation, and degrade behavior on budget exhaustion.
