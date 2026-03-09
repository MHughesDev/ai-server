# 20 Config and Feature Flags

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 12, 18.9, 18.11).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md` (schema drift, parse-only flags, fail-fast behavior).

## Configuration Sources
- Environment variables.
- Versioned config file overlays.
- Optional central configuration service.

## Configuration Requirements
- Runtime-impacting settings must be represented in validated schema.
- Invalid required config must fail startup in production.
- `CONFIG_FILE` parse/read errors should fail fast when explicitly configured.

## Core Feature Flags
- `enable_async_jobs`
- `enable_web_tool`
- `enable_org_memory`
- `enable_strict_verifier`
- `enable_cost_caps`
- `enable_multimodal_pipeline`
- `multimodal_input_path_enabled`
- `governance_harness_readiness_gate_active`
- `harness_autonomous_execution_enabled`
- `platform_production_rollout_enabled`
- `memory_retrieval_enabled`

Canonical rollout flag is `platform_production_rollout_enabled` (env: `PLATFORM_PRODUCTION_ROLLOUT_ENABLED`).
Legacy alias `PLATFORM_MASTER_ROLLOUT_ENABLED` is accepted for compatibility but should be retired in docs and deployment manifests.

## Governance Rule for Flags
- Flags are not documentation-only; each must map to explicit runtime behavior.
- Production rollout and readiness gates must be enforced in control paths (not advisory-only).

## Transport and Lifecycle Configuration
- `PORT`, `HTTPS_PORT`, `TLS_KEY_PATH`, `TLS_CERT_PATH`.
- Production target is fail-closed behavior when TLS is configured but invalid.
- Release traceability metadata: `RELEASE_ID`, `BUILD_ID`.

## Retention and Limits
- Memory retention controls: `MEMORY_RETENTION_TTL_SECONDS`, `MEMORY_RETENTION_MAX_CHUNKS_PER_SCOPE`.
- Multimodal attachment bounds: `MAX_ATTACHMENT_COUNT`, `MAX_ATTACHMENT_BYTES`, MIME/type allowlists.

## Current-State Notes
- Some sink settings and rollout gates still need full schema/runtime enforcement alignment.
- Feature flag parse vs behavior drift is tracked in the gaps report.
