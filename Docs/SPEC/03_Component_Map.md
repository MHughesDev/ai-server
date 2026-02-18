# 03 Component Map

## Planes
- Control Plane: policy, strategy, resource, supervision, failure, evaluation.
- Data Plane: router, pipelines, gateways, synthesizer.

## Components
Ingress, Brain Stem, Policy Gate, Router, Pipeline Harness, Model Gateway, Tool Gateway, Memory Abstraction, Observability.

## Dependency Rules
- Ingress cannot call models/tools.
- Pipelines cannot bypass policy/budgets.
- Tool access only via Tool Gateway.
- Memory access only via Memory Abstraction.
