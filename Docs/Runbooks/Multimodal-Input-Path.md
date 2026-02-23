# Multimodal Input Path Runbook (L2-07)

## Overview
When `MULTIMODAL_INPUT_PATH_ENABLED=true`, the server validates attachments (type, size, count, mime) at ingress and routes requests with image/file modality only to pipelines that support multimodal (e.g. `reactive_chat` when `ENABLE_MULTIMODAL_PIPELINE=true`).

## Attachment failure triage

| Error code | Cause | Action |
|------------|--------|--------|
| `ATTACHMENT_REJECTED` | Validation failed. Check `detail.attachment_reason`. | **unsupported_type**: Client sent type not in allowlist (image, pdf, json). Ask client to use supported type or add to allowlist after security review. **count_exceeded**: More than `MAX_ATTACHMENT_COUNT` (default 10). **too_large**: Single attachment exceeds `MAX_ATTACHMENT_BYTES` (default 4 MiB decoded). **invalid_mime**: Declared mime not in allowlist. |
| `MULTIMODAL_UNSUPPORTED` | Request had image/file modality but policy did not allow a multimodal-capable pipeline. | Ensure `enable_multimodal_pipeline` is true and policy/stub allows `reactive_chat` (or other capable pipeline). If intentional (e.g. tenant not allowed multimodal), inform caller. |

## Metrics
- `attachment_reject_total{reason="unsupported_type|count_exceeded|too_large|invalid_mime"}`: Rejection count by reason.
- Use existing `requests_total`, `security_deny_total` for blocked/denied requests.

## Capability mismatch
If clients report "Multimodal request but no capable pipeline allowed":
1. Confirm `MULTIMODAL_INPUT_PATH_ENABLED=true` and `ENABLE_MULTIMODAL_PIPELINE=true`.
2. Check policy evaluator / stub allows `reactive_chat` (or intended pipeline) in `allowed_pipelines`.
3. If rollout is staged, confirm tenant/cohort is allowed multimodal in policy.

## Kill switch
Set `MULTIMODAL_INPUT_PATH_ENABLED=false` to disable attachment validation and capability check; attachments will pass through envelope validation only (no size/count/mime checks) and routing will not require a capable pipeline.

## Supported matrix (implementation default)
- **Types**: image, pdf, json.
- **MIME allowlist**: image/png, image/jpeg, image/gif, image/webp, application/pdf, application/json.
- **Limits**: configurable via `MAX_ATTACHMENT_COUNT`, `MAX_ATTACHMENT_BYTES`.
