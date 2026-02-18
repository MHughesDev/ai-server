# AI Server Summary for Newcomers

This document explains the system in plain language for someone starting from zero.

## What this system is

This project is a central AI server. Other apps send requests to it, and it decides the best way to answer.

It does more than call one model. It can:
- choose an execution path (called a pipeline),
- use tools when needed (for example CLI or APIs),
- read memory and documents when needed,
- enforce safety and cost limits,
- return a response with traceable metadata.

Main API endpoint:
- `POST /v1/query`

Support endpoints:
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/version`

## What this system is not

- Not a simple pass-through proxy to one model.
- Not one giant all-purpose agent with no boundaries.
- Not a design where auth or rate limiting depends on AI output.

## The hard boundary: where "thinking" starts

The entry layer (`Ingress`) is intentionally non-AI.

`Ingress` only does predictable checks:
- authentication,
- rate limits and quotas,
- payload size checks,
- request normalization.

AI reasoning starts in `Brain Stem`. This is a strict design rule.

## Request flow (end to end)

1. Client sends request to `POST /v1/query`.
2. `Ingress` validates and normalizes request.
3. `Brain Stem` converts input into a standard internal format and detects intent.
4. `Policy/Strategy Gate` applies permissions and budgets.
5. `Pipeline Router` picks the best pipeline.
6. Selected pipeline runs (may use models, tools, and memory through gateways).
7. Response synthesizer returns final output and telemetry.

## Pipelines (the execution paths)

The server can choose different pipelines depending on the task:

- `chat`: simple Q&A and conversation.
- `coding_agent`: multi-step coding work with filesystem/CLI/tests.
- `rag`: answers grounded in documents with citations.
- `tool_agent`: tasks that need external tools/APIs.
- `multimodal_reasoning`: tasks that combine text with images/PDFs.

## Safety and control rules

Key operational rules:
- Pipelines cannot bypass policy or budget checks.
- Tool calls must go through the `Tool Gateway`.
- Memory reads/writes must go through the `Memory Abstraction`.
- Tools are blocked by default unless policy allows them.
- Requests have limits for tokens, cost, tool calls, and execution time.
- Sensitive data should be redacted in traces/logs.

## Data shapes you should know

External API contracts:
- `RequestEnvelope`: what clients send.
- `ResponseEnvelope`: what clients receive.

Core internal contracts:
- `CanonicalRequest`: normalized internal request.
- `IntentBundle`: task type + confidence + risk hints.
- `PolicyDecision`: what is allowed for this caller/request.
- `PipelinePlan`: exact execution setup (pipeline, tools, models, checks).

These contracts are the stable backbone of the system.

## Why this architecture exists

The design is built for:
- control (policy and budgets),
- reliability (clear boundaries and fallback paths),
- debuggability (traces and metrics),
- flexibility (different pipelines for different tasks),
- safe scaling (tool and memory access are gated).

## Current implementation direction

The docs define milestone-based delivery:
- Milestone 1: single endpoint + chat pipeline.
- Milestone 2: routing + policy gate + budgets.
- Milestone 3: coding agent harness + verification.
- Milestone 4: retrieval and multimodal support.

Use this summary first, then read `Docs/Architecture.md` for detailed contracts and component behavior.
