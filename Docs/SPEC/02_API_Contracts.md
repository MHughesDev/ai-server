# 02 API Contracts

## Transport
The server listens for HTTP on `PORT` (default 3000). When TLS key and certificate are configured, an HTTPS server is also started on `HTTPS_PORT` (default 3443). Clients may use either HTTP or HTTPS. See §20 Config for `TLS_KEY_PATH`, `TLS_CERT_PATH`, `HTTPS_PORT`.

## Endpoints
- `POST /v1/query`
- `GET /v1/jobs/{job_id}` (optional async)
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/version` — returns `contract_version`, `api`, `version` (app version), `env`; when set at deploy: `release_id`, `build_id` (L2-08 traceability).

## RequestEnvelope
- `request_id`
- `caller { app_id, user_id, org_id, session_id, scopes[] }`
- `input { text, attachments[], structured }`
- `preferences { response_format, verbosity, stream }`

## ResponseEnvelope
- `request_id`
- `status`
- `output { text, structured, citations[] }`
- `telemetry { pipeline, models_used, tool_calls, tokens_in, tokens_out, cost_usd_est, latency_ms }`
- `error { code, message, detail }`

## Error Taxonomy
`AUTH_INVALID`, `RATE_LIMITED`, `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `TOOL_TIMEOUT`, `MODEL_FAILURE`, `INTERNAL_ERROR`, `INVALID_PAYLOAD`, `CONTRACT_VERSION_UNSUPPORTED`, `ATTACHMENT_REJECTED` (L2-07), `MULTIMODAL_UNSUPPORTED` (L2-07)
