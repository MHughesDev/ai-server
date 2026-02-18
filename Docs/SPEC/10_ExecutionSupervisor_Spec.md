# 10 ExecutionSupervisor Spec

## Purpose
Observe and intervene in running pipelines.

## Inputs
Step events, verifier results, budget consumption, tool/model failures.

## Interventions
Pause, abort, replan, degrade, fallback escalation.

## Guarantees
Interventions are traceable with deterministic reason codes.
