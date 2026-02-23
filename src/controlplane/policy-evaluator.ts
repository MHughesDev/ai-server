/**
 * Policy evaluator – deterministic allow/deny and reason codes (L2-03 Phase 0).
 * @see Docs/SPEC/07_PolicyEngine_Spec.md, L2-03 GOV-001, GOV-002, L2-06 memory scope
 */

import type { PolicyDecision, MaxBudgets } from "../contracts/policy-decision.js";
import type { PolicyDenyReason } from "../contracts/policy-decision.js";
import type { PolicyInput } from "./policy-input.js";
import { getConfig } from "../bootstrap/index.js";

/** Parse comma-separated env list; empty string or unset => [] */
function parseDenyList(envValue: string | undefined): string[] {
  if (envValue == null || envValue.trim() === "") return [];
  return envValue.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Dynamic deny lists from env (L2-03 gap: dynamic policy refresh); (re)read on each evaluation. */
function getDenyOrgIds(): string[] {
  return parseDenyList(process.env.POLICY_DENY_ORG_IDS);
}
function getDenyAppIds(): string[] {
  return parseDenyList(process.env.POLICY_DENY_APP_IDS);
}

/** Default max budgets when policy allows (L2-03, SPEC 09) */
const DEFAULT_MAX_BUDGETS: MaxBudgets = {
  token_budget: 8192,
  tool_budget: 10,
  deadline_ms: 60_000,
  cost_budget_usd: 1.0,
};

/**
 * Evaluate policy for the given input. Deterministic: same input → same output.
 * Precedence: 1) explicit deny (org/app), 2) allow with constraints, 3) default deny.
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { caller, intent } = input;

  if (getDenyOrgIds().includes(caller.orgId)) {
    return denyDecision("POLICY_BLOCKED", "org_not_allowed");
  }
  if (getDenyAppIds().includes(caller.appId)) {
    return denyDecision("POLICY_BLOCKED", "app_not_allowed");
  }

  const primaryIntent = intent.primary_intent ?? "chat";
  const allowedPipelines = ["reactive_chat", "chat"];
  const hasAllowedIntent =
    allowedPipelines.includes(primaryIntent) || intent.intents.some((i) => allowedPipelines.includes(i));
  if (!hasAllowedIntent) {
    return denyDecision("POLICY_BLOCKED", "pipeline_not_allowed");
  }

  const riskFlags = intent.risk_flags ?? [];
  if (riskFlags.includes("high_risk") || riskFlags.includes("blocked")) {
    return denyDecision("POLICY_BLOCKED", "risk_flags");
  }

  let memoryScope: "user" | "project" | "org" | "none" = "none";
  try {
    memoryScope = getConfig().flags.enable_org_memory ? "org" : "none";
  } catch {
    // Unit tests may not call bootstrap(); keep none
  }
  return {
    allowed: true,
    allow_tools: [],
    deny_tools: [],
    memory_scope: memoryScope,
    max_budgets: { ...DEFAULT_MAX_BUDGETS },
    safety_profile: "standard",
    redaction_level: "minimal",
    audit_level: "summary",
    allowed_pipelines: allowedPipelines,
    strategy: "reactive",
  };
}

function denyDecision(reason: PolicyDenyReason, _detail: string): PolicyDecision {
  return {
    allowed: false,
    deny_reason: reason,
    allow_tools: [],
    deny_tools: [],
    memory_scope: "none",
    safety_profile: "standard",
    redaction_level: "minimal",
    audit_level: "summary",
    allowed_pipelines: [],
    strategy: undefined,
  };
}
