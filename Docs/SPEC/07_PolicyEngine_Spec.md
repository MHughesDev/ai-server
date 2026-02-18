# 07 PolicyEngine Spec

## Purpose
Deterministic permission, scope, safety, and budget decisions.

## Inputs
Actor identity, tenant policies, request metadata, intent/risk hints.

## Output
`PolicyDecision` with:
- allowed/denied tools
- memory scope
- token/tool/time/cost caps
- safety/redaction/audit profile

## Enforcement
Dispatcher and gateways must enforce policy on every request/step.
