# L2-07 Sprint Handoff – Multimodal Input Path Implementation

**Plan:** L2-07 Multimodal Input Path Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-08 Rollout and Operational Readiness, L2-99 Deferred Coding Agent Harness Readiness Gate  

---

## 1) L2-08 / L2-99 start checklist

- [x] Attachment validation (type, size, count, mime) at ingress when `multimodal_input_path_enabled`
- [x] Deterministic rejection taxonomy: `ATTACHMENT_REJECTED` (detail.attachment_reason), `MULTIMODAL_UNSUPPORTED`
- [x] Image/PDF/json preprocessors with token estimates; canonical request extended with per-handle token_estimate
- [x] Capability-aware routing: request with image/file modality requires a pipeline in `multimodalCapablePipelines` (e.g. reactive_chat when `enable_multimodal_pipeline`)
- [x] Feature flags: `multimodal_input_path_enabled` (default false), `enable_multimodal_pipeline`; config: `maxAttachmentCount`, `maxAttachmentBytes`
- [x] Metric: `attachment_reject_total{reason}`; runbook and support matrix in docs
- [x] Unit + integration tests: attachments, validate, preprocess, canonicalize, router capability, config, abuse/determinism
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-08 operational handoff / staged rollout

**Definition of ready for L2-08:** All items above except the review meeting are done. Rollout can enable multimodal via flags and use runbook for triage.

---

## 2) Multimodal contracts

### Feature flags and config

| Flag / config | Effect |
|---------------|--------|
| `multimodal_input_path_enabled` | When true, attachment validation runs at ingress; capability-aware routing applies. Default: false. Env: `MULTIMODAL_INPUT_PATH_ENABLED`. |
| `enable_multimodal_pipeline` | When true with above, `reactive_chat` is multimodal-capable; requests with image/file can route to it if policy allows. |
| `maxAttachmentCount` | Max attachments per request (default 10). Env: `MAX_ATTACHMENT_COUNT`. |
| `maxAttachmentBytes` | Max decoded bytes per attachment (default 4 MiB). Env: `MAX_ATTACHMENT_BYTES`. |

### Error codes (API taxonomy)

| Code | HTTP | Retryable | When |
|------|------|-----------|------|
| ATTACHMENT_REJECTED | 400 | No | Validation failed: unsupported_type, count_exceeded, too_large, invalid_mime (see `detail.attachment_reason`) |
| MULTIMODAL_UNSUPPORTED | 400 | No | Request has image/file modality but policy does not allow a multimodal-capable pipeline |

### Supported matrix (implementation default)

- **Types:** image, pdf, json (type `other` rejected when multimodal path enabled).
- **MIME allowlist:** image/png, image/jpeg, image/gif, image/webp, application/pdf, application/json.
- **Limits:** configurable via env; see runbook.

---

## 3) Module layout

- **Ingress:** `src/ingress/attachments.ts` (validateAttachments, limits); `validate.ts` calls it when `multimodalInputPathEnabled` and attachments present. Routes pass config limits.
- **Brain stem:** `src/brainstem/preprocess.ts` (preprocessAttachment / preprocessAttachments); `canonicalize.ts` uses for handles and total token_estimate.
- **Router:** `src/router/default-router.ts` checks `multimodalCapablePipelines`; denies with MULTIMODAL_UNSUPPORTED when modality is image/file and no capable pipeline allowed.
- **Control plane:** Passes `multimodalCapablePipelines` from query-handler (derived from flags) into router.plan().
- **Observability:** `attachment_reject_total` incremented in routes on ATTACHMENT_REJECTED (label `reason`).

---

## 4) CI and verification

| Check | Command / location |
|-------|---------------------|
| Unit tests (attachments, validate, preprocess, canonicalize, router) | `npm test` (src/ingress/*.test.ts, src/brainstem/*.test.ts, src/router/default-router.test.ts) |
| Config (multimodal flags, attachment limits) | `npm test` (src/config/schema.test.ts) |
| Full suite | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

---

## 5) Known limits and deferred work

- **Preprocessing:** Deterministic token estimates only; no heavy image/PDF parsing or embedding in MVP.
- **Dashboards/alerts:** Out of scope for this repo (UI-less server); metrics and runbook are in place; dashboard/alert panels are deferred to ops/external tooling.
- **Kill switch:** Set `MULTIMODAL_INPUT_PATH_ENABLED=false` to disable validation and capability check.

---

## 6) References

- Plan: `docs/PLANS/Implementation-plans/L2-07_Multimodal-Input-Path-Implementation.md`
- **SOW:** Segment L (L.1a–L.1d) verifies L2-07 implementation and runbook linkage; see `docs/PLANS/Scope-of-Work.md` §4.1, §9 Segment L.
- Runbook: `docs/Runbooks/Multimodal-Input-Path.md` (or `docs/Runbooks/` — check both path forms)
- Spec: `docs/SPEC/` or `docs/SPEC/`: 04_Ingress_Spec.md, 05_BrainStem_Spec.md, 20_Config_and_FeatureFlags.md, 02_API_Contracts.md
- Config: `src/config/schema.ts` (multimodal_input_path_enabled, maxAttachmentCount, maxAttachmentBytes)
