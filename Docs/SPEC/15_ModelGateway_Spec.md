# 15 Model Gateway Spec

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 10, 12, 18.5).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Single model execution boundary for all model-using engines with policy-aware routing, retries/fallbacks, and usage accounting.

## Production Target State
- Support external and internal model providers.
- Resolve model selection by:
  - Capability type (chat/classification/embedding/vision/multimodal/etc.).
  - Scope/tenancy (org-wide, app-scoped, user-scoped).
- Use caller context + policy constraints for final provider/model selection.
- Enforce timeout, retryability classification, and deterministic error mapping.

## Current-State Note
- Runtime query path is wired through provider-backed model gateway routing.
- Provider/model selection is resolved by capability plus scope precedence (`user` -> `app` -> `org` -> capability default).
- Runtime config carries provider registry and routing map under `model_gateway` in `src/config/schema.ts`.

## Production Hardening Features (Agent 3, 2026-03-06)

### Circuit Breaker Pattern
The Model Gateway implements circuit breaker protection for provider resilience:
- **States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- **Configuration**: `failureThreshold` (default 5), `recoveryTimeoutMs` (default 30000), `halfOpenMaxCalls` (default 3)
- **Health Tracking**: Global `providerHealth` map tracks state, failures, last success/failure times
- **API**: `getProviderHealth()`, `getAllProviderHealth()`, `resetProviderHealth()` for observability

### Provider Health Checks
- **Check Function**: `checkProviderHealth(providerId, gateway, testRequest)` returns latency and health status
- **Bulk Checks**: `runProviderHealthChecks(config)` validates all configured providers
- **Integration**: Health check results update circuit breaker state automatically

### Fallback Provider Mechanism
- **Configuration**: `fallback_provider` in `ModelRoutingConfig` specifies backup provider ID
- **Behavior**: When primary provider fails (or circuit breaker opens), gateway automatically tries fallback
- **Fallback Marking**: Response includes fallback indicator in model field for telemetry

### Capability Taxonomy
Standard capabilities for routing decisions:
| Capability | Description | Default Model |
|------------|-------------|---------------|
| chat | General conversational AI | gpt-4o-mini |
| classification | Intent/category classification | gpt-4o-mini |
| vision | Image understanding/analysis | gpt-4o |
| embedding | Vector embedding generation | text-embedding-3-small |
| code | Code generation/analysis | gpt-4o |
| summarization | Text summarization | gpt-4o-mini |
| extraction | Structured data extraction | gpt-4o-mini |
| reasoning | Complex reasoning tasks | o1-mini |

**Export**: `CAPABILITY_TAXONOMY` constant and `CapabilityType` union type available for type-safe routing.

## Engine-Facing Contracts
All model-using engines call Model Gateway; engines do not call providers directly.

**ModelInvokeRequest**
```json
{
  "request_id": "<uuid>",
  "model_id": "<provider_model_id>",
  "task": "<generation|classification|embedding|vision|ranking|other>",
  "input": {
    "text": "<optional>",
    "messages": [],
    "artifacts": [],
    "attachments": []
  },
  "parameters": {
    "temperature": "<0..2>",
    "top_p": "<0..1>",
    "max_output_tokens": "<int>",
    "stop": ["<string>"],
    "response_format": "<text|json|schema_ref>"
  },
  "budgets": { "token_budget": "<int>", "cost_budget_usd": "<float>", "deadline_ms": "<int>" },
  "safety": { "profile": "<standard|strict|regulated>", "redaction_level": "<none|low|medium|high>" },
  "metadata": { "trace_id": "<string>", "engine_type": "<planning|execution|evaluation|classification|synthesis|condensing>", "contract_version": "v1" }
}
```

**ModelInvokeResponse**
```json
{
  "request_id": "<uuid>",
  "status": "<ok|error|blocked>",
  "output": {
    "text": "<model_output_text_optional>",
    "structured": { "model_output": "<json_optional>" },
    "embeddings": ["<vector_optional>"],
    "labels": [ { "label": "<label>", "confidence": "<0..1>" } ]
  },
  "usage": { "tokens_in": "<int>", "tokens_out": "<int>", "cost_usd": "<float>" },
  "model_info": { "provider": "<string>", "model_id": "<string>", "latency_ms": "<int>" },
  "error": { "code": "<string>", "message": "<string>" }
}
```
