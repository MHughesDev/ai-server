/**
 * Default router – MVP chat + coding_agent when policy and intent allow (L2-03, M3).
 * WANT-007: Pipeline **selection** follows intent (`routing_hints`), complexity (`tool_likelihood`), and policy
 * allowlists — not raw modality strings. Multimodal is a **capability gate** via
 * `intent.constraints_hints.needs_attachment_processing` (set in brain stem from canonical).
 * @see docs/SPEC/13_Router_and_Dispatch_Spec.md, L2-07 Phase 2
 */

import type { IRouter, RouterInput, RouteResult } from "./types.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import { policyDenyReasonToErrorCode, type PolicyDenyReason } from "../contracts/policy-decision.js";
import { getConfig } from "../bootstrap/index.js";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import {
  toolIdRequiresFilesystemAccess,
  toolIdRequiresNetworkAccess,
} from "../gateways/tool-gateway.js";

/** Router: deny when policy denied; else allow with reactive_chat or coding_agent plan. */
export const defaultRouter: IRouter = {
  plan(input: RouterInput): Promise<RouteResult> {
    if (!input.policy.allowed) {
      const reason = (input.policy.deny_reason ?? "POLICY_BLOCKED") as PolicyDenyReason;
      return Promise.resolve({
        allowed: false,
        denyReason: policyDenyReasonToErrorCode(reason),
      });
    }

    const capablePipelines = input.multimodalCapablePipelines ?? [];
    const needsAttachmentCapability =
      input.intent.constraints_hints?.needs_attachment_processing === true;
    if (needsAttachmentCapability && capablePipelines.length > 0) {
      const allowed = input.policy.allowed_pipelines ?? [];
      const hasCapable = capablePipelines.some((p) => allowed.includes(p));
      if (!hasCapable) {
        return Promise.resolve({ allowed: false, denyReason: "MULTIMODAL_UNSUPPORTED" });
      }
    }

    const allowed = input.policy.allowed_pipelines ?? [];
    const useCodingAgent =
      allowed.includes("coding_agent") && (input.intent.complexity?.tool_likelihood ?? 0) >= 0.5;
    const useDeepResearch =
      allowed.includes("deep_research") &&
      (input.intent.routing_hints ?? []).includes("deep_research");
    const useDecision =
      allowed.includes("decision") && (input.intent.routing_hints ?? []).includes("decision");
    const useCompositeExample =
      allowed.includes("composite_example") &&
      (input.intent.routing_hints ?? []).includes("composite_example");
    const useToolAutomation =
      allowed.includes("tool_automation") &&
      (input.intent.routing_hints ?? []).includes("tool_automation");
    const useExtraction =
      allowed.includes("extraction") && (input.intent.routing_hints ?? []).includes("extraction");
    const useVerification =
      allowed.includes("verification") && (input.intent.routing_hints ?? []).includes("verification");
    const usePlanningOnly =
      allowed.includes("planning_only") && (input.intent.routing_hints ?? []).includes("planning_only");
    const useBatchAnalysis =
      allowed.includes("batch_analysis") && (input.intent.routing_hints ?? []).includes("batch_analysis");
    const useChat = allowed.includes("reactive_chat") || allowed.includes("chat");

    const pipelineType = useCodingAgent
      ? "coding_agent"
      : useDeepResearch
        ? "deep_research"
        : useDecision
          ? "decision"
          : useCompositeExample
            ? "composite_example"
            : useToolAutomation
              ? "tool_automation"
              : useExtraction
                ? "extraction"
                : useVerification
                  ? "verification"
                  : usePlanningOnly
                    ? "planning_only"
                    : useBatchAnalysis
                      ? "batch_analysis"
                      : useChat
                        ? "reactive_chat"
                        : "reactive_chat";
    /** L2-05: tools_enabled from PolicyDecision (allow_tools minus deny_tools). */
    const allowedTools = (input.policy.allow_tools ?? []).filter(
      (t) => !(input.policy.deny_tools ?? []).includes(t)
    );
    const toolsEnabled = useCodingAgent ? allowedTools : [];

    let harnessAutonomousExecution = false;
    if (pipelineType === "coding_agent" && toolsEnabled.length > 0) {
      try {
        const config = getConfig();
        harnessAutonomousExecution = resolveFeatureFlagEnabled(
          "harness_autonomous_execution_enabled",
          config,
          {
            org_id: input.caller.orgId,
            app_id: input.caller.appId,
            user_id: input.caller.userId,
          }
        );
      } catch {
        harnessAutonomousExecution = false;
      }
    }

    const plan: PipelinePlan = {
      pipeline_type: pipelineType,
      strategy_id: useCodingAgent
        ? "coding_agent"
        : useDeepResearch
          ? "deep_research"
          : useDecision
            ? "decision"
            : useCompositeExample
              ? "composite_example"
              : useToolAutomation
                ? "tool_automation"
                : useExtraction
                  ? "extraction"
                  : useVerification
                    ? "verification"
                    : usePlanningOnly
                      ? "planning_only"
                      : useBatchAnalysis
                        ? "batch_analysis"
                        : "reactive",
      execution_mode: "sync_stream",
      ...(harnessAutonomousExecution ? { harness_autonomous_execution: true } : {}),
      budgets: input.policy.max_budgets
        ? {
            token_budget: input.policy.max_budgets.token_budget ?? 4096,
            tool_budget: input.policy.max_budgets.tool_budget ?? 10,
            deadline_ms: input.policy.max_budgets.deadline_ms ?? 30_000,
            cost_budget_usd: input.policy.max_budgets.cost_budget_usd ?? 0.5,
          }
        : { token_budget: 4096, tool_budget: 10, deadline_ms: 30_000, cost_budget_usd: 0.5 },
      verification_level: "basic",
      tools_enabled: toolsEnabled,
      /**
       * L2-05: tool timeout from budget; network/filesystem flags match built-in tool requirements
       * so AllowlistToolGateway does not deny web_search / file_write_preview when policy allows them (§9.12).
       */
      sandbox:
        toolsEnabled.length > 0
          ? {
              ...(input.policy.max_budgets?.deadline_ms != null
                ? { timeout_ms: Math.min(input.policy.max_budgets.deadline_ms, 30_000) }
                : {}),
              ...(toolsEnabled.some((id) => toolIdRequiresNetworkAccess(id))
                ? { network_access: true as const }
                : {}),
              ...(toolsEnabled.some((id) => toolIdRequiresFilesystemAccess(id))
                ? { filesystem_access: true as const }
                : {}),
            }
          : undefined,
    };
    return Promise.resolve({ allowed: true, pipelinePlan: plan });
  },
};
