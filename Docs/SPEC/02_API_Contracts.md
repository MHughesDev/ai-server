# 02 API Contracts

## Endpoints
- `POST /v1/query`
- `GET /v1/jobs/{job_id}` (optional async)
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/version`

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
`AUTH_INVALID`, `RATE_LIMITED`, `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `TOOL_TIMEOUT`, `MODEL_FAILURE`, `INTERNAL_ERROR`
