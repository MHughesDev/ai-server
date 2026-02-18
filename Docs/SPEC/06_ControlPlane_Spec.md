# 06 ControlPlane Spec

## Purpose
Govern execution without generating end-user answers.

## Modules
Policy Engine, Strategy Engine, Resource Manager, Execution Supervisor, Failure Manager, Evaluation Engine.

## Inputs/Outputs
- Inputs: intent, caller context, runtime health.
- Outputs: `PolicyDecision`, `PipelinePlan`.

## Guarantees
No direct tool execution; all constraints are enforceable machine fields.
