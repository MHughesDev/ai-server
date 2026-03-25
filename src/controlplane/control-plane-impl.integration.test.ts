/**
 * Control plane integration tests – policy deny, budget enforcement, single PipelinePlan (L2-03 C.5).
 * Exercises createControlPlane().decide() with defaultRouter; no HTTP.
 */

import { createControlPlane } from "./control-plane-impl.js";
import { defaultRouter } from "../router/default-router.js";
import type { ControlPlaneInput } from "./types.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { IntentBundle } from "../contracts/intent-bundle.js";
import type { CallerContext } from "../ingress/types.js";
import { resetTenantBudgets } from "./tenant-budget.js";

function makeCaller(overrides: Partial<CallerContext> = {}): CallerContext {
  return {
    appId: "app1",
    userId: "user1",
    orgId: "org1",
    sessionId: "s1",
    scopes: [],
    ...overrides,
  };
}

function makeCanonical(overrides: Partial<CanonicalRequest> = {}): CanonicalRequest {
  return {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    modalities: ["text"],
    text: "hello",
    attachments: [],
    token_estimate: 100,
    caller_app_id: "app1",
    caller_user_id: "user1",
    caller_org_id: "org1",
    ...overrides,
  };
}

function makeIntent(overrides: Partial<IntentBundle> = {}): IntentBundle {
  return {
    intents: ["chat"],
    confidence: 0.9,
    primary_intent: "chat",
    ...overrides,
  };
}

describe("control plane integration", () => {
  beforeEach(async () => {
    await resetTenantBudgets();
    delete process.env.POLICY_DENY_ORG_IDS;
    delete process.env.POLICY_DENY_APP_IDS;
    delete process.env.TENANT_COST_CAP_USD_PER_HOUR;
    delete process.env.TENANT_BUDGET_POSTGRES_URL;
  });

  it("returns allowed and single PipelinePlan when policy and budget pass", async () => {
    const controlPlane = createControlPlane({ router: defaultRouter });
    const input: ControlPlaneInput = {
      canonical: makeCanonical(),
      intent: makeIntent(),
      caller: makeCaller(),
    };
    const result = await controlPlane.decide(input);
    expect(result.policyDecision.allowed).toBe(true);
    expect(result.routeResult.allowed).toBe(true);
    expect(result.pipelinePlan).toBeDefined();
    expect(result.pipelinePlan?.pipeline_type).toBe("reactive_chat");
    expect(result.pipelinePlan?.strategy_id).toBe("reactive");
  });

  it("denies with POLICY_BLOCKED when org is in POLICY_DENY_ORG_IDS", async () => {
    process.env.POLICY_DENY_ORG_IDS = "org1";
    const controlPlane = createControlPlane({ router: defaultRouter });
    const input: ControlPlaneInput = {
      canonical: makeCanonical(),
      intent: makeIntent(),
      caller: makeCaller({ orgId: "org1" }),
    };
    const result = await controlPlane.decide(input);
    expect(result.policyDecision.allowed).toBe(false);
    expect(result.policyDecision.deny_reason).toBe("POLICY_BLOCKED");
    expect(result.routeResult.allowed).toBe(false);
    expect(result.routeResult.denyReason).toBe("POLICY_BLOCKED");
    expect(result.pipelinePlan).toBeUndefined();
  });

  it("denies with POLICY_BLOCKED when risk_flags contain high_risk", async () => {
    const controlPlane = createControlPlane({ router: defaultRouter });
    const input: ControlPlaneInput = {
      canonical: makeCanonical(),
      intent: makeIntent({ risk_flags: ["high_risk"] }),
      caller: makeCaller(),
    };
    const result = await controlPlane.decide(input);
    expect(result.policyDecision.allowed).toBe(false);
    expect(result.policyDecision.deny_reason).toBe("POLICY_BLOCKED");
    expect(result.routeResult.allowed).toBe(false);
    expect(result.pipelinePlan).toBeUndefined();
  });

  it("denies with BUDGET_EXCEEDED when token_estimate exceeds policy token_budget", async () => {
    const controlPlane = createControlPlane({ router: defaultRouter });
    const input: ControlPlaneInput = {
      canonical: makeCanonical({ token_estimate: 100_000 }),
      intent: makeIntent(),
      caller: makeCaller(),
    };
    const result = await controlPlane.decide(input);
    expect(result.routeResult.allowed).toBe(false);
    expect(result.routeResult.denyReason).toBe("BUDGET_EXCEEDED");
    expect(result.pipelinePlan).toBeUndefined();
  });

  it("denies with BUDGET_EXCEEDED when tenant hourly cost cap exceeded", async () => {
    const { recordTenantUsage } = await import("./tenant-budget.js");
    process.env.TENANT_COST_CAP_USD_PER_HOUR = "1";
    await recordTenantUsage("org1", { cost_usd: 0.6 });
    await recordTenantUsage("org1", { cost_usd: 0.5 });
    const controlPlane = createControlPlane({ router: defaultRouter });
    const input: ControlPlaneInput = {
      canonical: makeCanonical(),
      intent: makeIntent(),
      caller: makeCaller({ orgId: "org1" }),
    };
    const result = await controlPlane.decide(input);
    expect(result.routeResult.allowed).toBe(false);
    expect(result.routeResult.denyReason).toBe("BUDGET_EXCEEDED");
    expect(result.pipelinePlan).toBeUndefined();
  });
});
