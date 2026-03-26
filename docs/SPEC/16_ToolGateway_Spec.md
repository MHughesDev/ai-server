# 16 Tool Gateway Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 10.4, 12, 16, 18.6).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (stub delegate and sandbox control completeness).

## Purpose
Secure, policy-gated, sandboxed tool execution boundary used only by Tool Engine.

## Responsibilities
- Validate tool invocation schema and identity context.
- Enforce allowlist/denylist policy and sandbox settings.
- Apply timeout/retry/circuit behavior with deterministic deny reasons.
- Emit auditable and redacted tool events.

## Policy Binding
- `PipelinePlan.tools_enabled` is derived from `PolicyDecision` (`allow_tools` minus `deny_tools`).
- Tool gateway must deny by default when allowlist is empty or missing.

## Current Runtime Shape
- `DenyOnlyToolGateway` default deny mode.
- `AllowlistToolGateway` enforces allowlist and timeout.
- `StubAllowedToolGateway` supports test/stub runs.

## Production Target State
- Replace stub delegate with real side-effecting tool execution under sandbox controls.
- Enforce network/filesystem controls at runtime boundary (not metadata-only).
- Bind invocation identity to audit payloads for attributable actions.

## Observability and Audit
- `TOOL_START` / `TOOL_END` / `TOOL_ACCESS` are emitted from **`tool_engine`** (central path for registry, workflows, and harnesses): payloads include `tool_id`, `invocation_id`, and **caller_org / caller_app / caller_user** (telemetry allowlist). Gateway **`invoke`** still receives full **`caller_identity`**.
- **`EngineInvocation.metadata.audit_level`** / **`redaction_level`** (from policy when set by **`workflows/runner`** or **`coding-agent-pipeline`**) gate **`TOOL_ACCESS`** and redaction; default **`summary`** / **`minimal`** when omitted.

## Production Implementation Details (Agent 3, 2026-03-06)

### Caller Identity Context
Tool invocations include full caller identity for audit and attribution:
```typescript
{
  org_id: string;           // Organization identifier
  app_id: string;           // Application identifier  
  user_id: string;          // User identifier
  session_id?: string;      // Session/trace correlation
  roles?: string[];         // Caller roles/permissions
  trace_id?: string;        // Distributed trace ID
  invocation_id?: string;   // Request invocation ID
}
```

**Implementation**: `src/engines/tool_engine.ts` passes identity from `EngineInvocation.actor_context` to `ToolInvokeRequest.caller_identity`.

### Sandbox Enforcement
The `AllowlistToolGateway` enforces sandbox controls:
- **Timeout**: `timeout_ms` per tool invocation via `Promise.race()`
- **Network Access**: Enforced for tools with `requires_network: true` metadata
- **Filesystem Access**: Enforced for tools with `requires_filesystem: true` metadata
- **Path Resolution**: `TOOL_FILESYSTEM_ROOT` env var restricts filesystem operations

### Built-in Tools
The `ExecutableToolGateway` provides production-ready tools:
- **stub_tool**: Test/diagnostic tool returning caller identity
- **web_search**: DuckDuckGo search (requires network)
- **file_write_preview**: Sandboxed file write (requires filesystem)
