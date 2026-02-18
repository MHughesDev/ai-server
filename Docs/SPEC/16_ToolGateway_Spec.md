# 16 ToolGateway Spec

## Purpose
Secure, sandboxed, policy-gated tool execution.

## Responsibilities
Tool schema validation, sandbox execution, network/filesystem restrictions, scoped secret injection, timeout/retry/circuit breakers, result normalization.

## Observability
Emit start/end/error events with duration, status, and sanitized artifacts.
