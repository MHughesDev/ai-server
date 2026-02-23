# 20 Config and Feature Flags

## Sources
Environment variables, versioned config files, optional central config service.

## Feature Flags
`enable_async_jobs`, `enable_web_tool`, `enable_org_memory`, `enable_strict_verifier`, `enable_cost_caps`, `enable_multimodal_pipeline`, `multimodal_input_path_enabled`, `governance_harness_readiness_gate_active`.

- **multimodal_input_path_enabled** (L2-07): When true, attachment validation (type/size/count/mime) runs at ingress; capability-aware routing applies. Default: false in production. Env: `MULTIMODAL_INPUT_PATH_ENABLED`.

- **enable_multimodal_pipeline**: When true with `multimodal_input_path_enabled`, `reactive_chat` is treated as multimodal-capable for routing.

- **governance_harness_readiness_gate_active** (L2-99): When true, the harness readiness gate workflow is active (evidence collection, scorecard, go/no-go). Harness execution remains disabled until a formal go decision. Default: true. Env: `GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE`.

- **platform_production_rollout_enabled** (L2-08): Production rollout gate; default `false`. Set `true` only after operational readiness gate passes. Used as kill-switch. Env: `PLATFORM_PRODUCTION_ROLLOUT_ENABLED`.

## L2-07 Attachment limits
When multimodal input path is enabled: `MAX_ATTACHMENT_COUNT` (default 10), `MAX_ATTACHMENT_BYTES` (default 4 MiB per attachment, decoded size). Allowed types: image, pdf, json. Allowed MIME allowlist in code (image/png, image/jpeg, image/gif, image/webp, application/pdf, application/json).

## HTTP/HTTPS (TLS)
- **PORT** (default 3000): HTTP server port. Always listened on.
- **HTTPS_PORT** (default 3443): Port for the HTTPS server when TLS is enabled.
- **TLS_KEY_PATH**: Path to the TLS private key file (PEM). When set together with `TLS_CERT_PATH`, an HTTPS server is started in addition to HTTP.
- **TLS_CERT_PATH**: Path to the TLS certificate file (PEM). When set together with `TLS_KEY_PATH`, HTTPS is enabled.

If either path is missing or unreadable at startup, the server logs an error and runs HTTP only.

## Release metadata (L2-08)
Optional `RELEASE_ID` and `BUILD_ID` for artifact traceability; exposed in `GET /v1/version` and audit. Canary thresholds and rollout policy: `src/rollout/policy.ts`. Runbooks: `docs/Runbooks/Release-and-Rollback.md`.

## Rollout
Staged rollout with metrics guardrails and kill switches.
