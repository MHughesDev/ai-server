# How the Server Works — A High-Level Guide

This document explains **how** the AI server works from end to end, in **strict processing order**. It is written for anyone who wants to understand the system conceptually, without implementation details.

---

## What This Server Is

The server is a **central AI endpoint** that applications call with a single request. The server’s job is to:

- Figure out **what** the user wants (intent).
- Decide **how** to answer (which pipeline to use).
- Use **models**, **tools**, and **memory** only when allowed and within limits.
- Return one coherent response, with full traceability of what happened.

**One entry point, many possible internal paths.** The server chooses the path; the client does not.

---

## The Golden Rule: Where Intelligence Starts

- **Before “Brain Stem”:** the server does **no** AI reasoning. It only checks identity, limits, and request shape. This is “mindless” by design.
- **After “Brain Stem”:** the first place that interprets meaning and decides strategy is the Brain Stem. All cognition starts there.

That split keeps security and policy enforcement predictable and independent of model behavior.

---

## Query Processing Order (Step-by-Step)

The following steps happen **in this exact order** for every `POST /v1/query` request.

| # | Stage | What happens | No AI? |
|---|-------|----------------|--------|
| 1 | [HTTP & Ingress](#1-http--ingress) | Request received, body read, validated; caller identity and envelope produced. | ✓ |
| 2 | [Brain Stem — Canonicalize](#2-brain-stem--canonicalize) | Input normalized to a single internal form (text, attachments, modalities, token estimate). | ✓ |
| 3 | [Brain Stem — Intent](#3-brain-stem--intent) | Intent and complexity extracted (first “understanding” of the request). | — |
| 4 | [Control Plane — Policy](#4-control-plane--policy) | Policy evaluated: who may do what; allowed pipelines, memory scope, budgets. | ✓ |
| 5 | [Control Plane — Budget](#5-control-plane--budget) | Request and tenant budgets checked; effective limits set. | ✓ |
| 6 | [Control Plane — Router](#6-control-plane--router) | Strategy and pipeline chosen; pipeline plan produced (models, tools, memory, budgets). | ✓ |
| 7 | [Dispatch Gate](#7-dispatch-gate) | Final check: only if policy allowed and a valid plan exists does execution proceed. | ✓ |
| 8 | [Retrieval (optional)](#8-retrieval-optional) | If plan allows memory and scope is set, run retrieval; attach context and citations for pipeline. | ✓ |
| 9 | [Pipeline Execution](#9-pipeline-execution) | Chosen pipeline runs (e.g. chat): model gateway, tools, synthesis; all through gateways. | — |
| 10 | [Response & Observability](#10-response--observability) | Response envelope returned; metrics, audit, and telemetry recorded. | ✓ |

---

### 1. HTTP & Ingress

**Where:** `POST /v1/query` → route handler → `validateIngress()`.

- Request body is read (with size limit).
- Payload is validated against the request contract (envelope shape, contract version, attachments).
- Caller identity is derived (e.g. from headers): `app_id`, `user_id`, `org_id`, `session_id`, `scopes`.
- A **request ID** is assigned or taken from header and passed through the rest of the flow.

**Output:** A **validated request envelope** plus **caller context**. No models, no tools, no understanding of content.

---

### 2. Brain Stem — Canonicalize

**Where:** First step inside `handleQuery()`: `canonicalize(ingressResult.envelope)`.

- Text is normalized (trimmed, single string).
- Attachments are preprocessed (mime, token estimates); modalities detected (text, image, file, structured).
- A **token estimate** for the request is computed.

**Output:** A **canonical request** — one internal, normalized form the rest of the system uses.

---

### 3. Brain Stem — Intent

**Where:** Right after canonicalize: `extractIntent(canonical)`.

- **Intent** is extracted: what the user is likely asking for (e.g. chat, coding help, document search).
- **Confidence** and **routing hints** are set (e.g. `reactive_chat`).
- Optional: complexity or risk flags.

**Output:** An **intent bundle** — “what this request is” and “how it might be handled.” This is the **first place the server “thinks”** about the request; it stays cheap (no long tool loops, no heavy retrieval).

---

### 4. Control Plane — Policy

**Where:** `createControlPlane().decide()` → `evaluatePolicy()`.

- Policy is evaluated for this **caller** and **canonical + intent**.
- Decision: **allowed** or **denied**; if denied, a **deny reason** (e.g. policy, pipeline not allowed).
- If allowed: **allowed pipelines**, **memory scope**, **safety profile**, and **max budgets** (tokens, tools, time, cost) are set.

**Output:** A **policy decision**. No execution yet; only “what is permitted.”

---

### 5. Control Plane — Budget

**Where:** Inside `decide()` after policy: `checkBudget()`, `checkTenantBudget()`.

- **Request-level** budget is checked (tokens, cost, etc.) against policy limits.
- **Tenant-level** budget (e.g. org) is checked so one tenant cannot exhaust shared resources.
- **Effective budgets** are computed for the rest of the run.

**Output:** Budget allowed or denied. If denied, routing is not attempted; result is “blocked” with `BUDGET_EXCEEDED`.

---

### 6. Control Plane — Router

**Where:** Inside `decide()` after policy and budget: `router.plan()`.

- Given **canonical**, **intent**, **policy** (including effective budgets), and **multimodal-capable pipelines**, the router picks a **strategy** and **pipeline**.
- It produces a **pipeline plan**: which pipeline runs, which models, tools, memory settings, and under which budgets.

**Output:** A **route result** (allowed + pipeline plan, or denied + reason). The control plane returns **policy decision**, **route result**, and **pipeline plan** (if allowed).

---

### 7. Dispatch Gate

**Where:** After `controlPlane.decide()`: `canDispatch(result)` / `assertCanDispatch(result)`.

- Checks that the control plane **allowed** the request and produced a **valid pipeline plan**.
- If not allowed or no plan: **no pipeline runs**; a blocked response is returned with appropriate deny reason (policy, budget, or routing).
- If allowed: code asserts and proceeds to execution.

**Purpose:** Final guard so that only explicitly allowed, planned work is executed (no bypass of policy or budgets).

---

### 8. Retrieval (optional)

**Where:** After dispatch gate, before pipeline run; only if plan has memory retrieval and scope is not `none`.

- **Retrieval** runs in the configured **memory scope** (e.g. user, project, org) with the canonical text and `top_k`.
- Result is **context text** and **citations**.
- On failure or degraded store, the server can proceed without context (fallback); metrics and events record the outcome.

**Output:** **Retrieval context** (and optional citations) passed into the pipeline as part of the harness input.

---

### 9. Pipeline Execution

**Where:** `createChatPipeline(gateway).run(harnessInput)` (or other pipeline type from the plan).

- The **pipeline** (e.g. reactive chat) receives: canonical request, intent, policy decision, pipeline plan, caller, and optional retrieval context.
- It orchestrates **stages** (e.g. build prompt, call model, synthesize answer).
- All **model** calls go through the **model gateway** (provider, fallbacks, token counting, cost).
- Any **tool** or **memory** use would go through their gateways (sandboxing, scope, audit).

**Output:** A **response envelope**: status, output (e.g. text, citations), and **telemetry** (pipeline, models used, tokens, cost, latency).

---

### 10. Response & Observability

**Where:** After pipeline returns; inside `handleQuery()`.

- **Response envelope** is finalized (telemetry merged, tenant usage recorded).
- **Metrics** are updated (request count, latency, route, errors, retrieval, security denials).
- **Events** may be emitted (e.g. `POLICY_DECISION`, `ROUTE_DECISION`, `PIPELINE_START`, `PIPELINE_END`, `FINAL_SYNTH`, `ERROR`).
- **Audit** may write security-relevant events (e.g. policy decision, route deny, errors) when hard controls are enabled.

**Output:** JSON response sent back to the client; every request is **traceable** (routing, policy, budgets, pipeline steps, tool events).

---

## Concepts in Short

- **Ingress:** Mindless entry — auth, size, validation only; no AI.
- **Brain Stem:** First cognition — canonicalize input, then intent; no heavy tools or retrieval.
- **Control plane:** Governs only — policy → budget → router; no execution.
- **Dispatch gate:** Ensures only allowed, planned work runs.
- **Pipeline:** One execution harness per “way of working” (e.g. chat, coding, RAG).
- **Gateways:** Single choke points for models, tools, and memory; enforce policy, budgets, and observability.
- **Observability:** Every run can be traced and measured (routing, policy, costs, steps).

---

## Why It’s Built This Way

- **Single endpoint:** Clients get one stable API; the server decides how to fulfill each request.
- **Strict boundary:** Ingress never “thinks”; cognition starts at the Brain Stem, so security and quotas don’t depend on AI.
- **Policy and budgets:** Enforced in one place (control plane) and at gateways, so they can’t be bypassed by pipelines.
- **Pluggable pipelines:** New ways of working (new “agent harnesses”) can be added without changing the entry point or the rules.
- **Traceability:** Routing, policy, and execution are observable so you can debug, tune, and improve over time.

---

## Summary

The server receives a request at a single entry point (**HTTP & Ingress**), validates it without using AI, then uses the **Brain Stem** to canonicalize and extract intent. The **Control Plane** then evaluates policy, checks budgets, and routes to a pipeline plan; the **Dispatch Gate** ensures only that plan runs. Optional **Retrieval** adds context when allowed; the chosen **Pipeline** executes through gateways, and the **Response** is returned with full telemetry. **Ingress is mindless; cognition begins at the Brain Stem; policy and budgets govern everything; execution goes through pipelines and gateways; every run is traceable.**
