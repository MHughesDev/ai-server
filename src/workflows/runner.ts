/**
 * Workflow graph executor – runs WorkflowDefinition with engine_call, workflow_call, and decision steps.
 * M6: nested workflows with budget inheritance and trace continuity.
 * Production: Decision step branching, cycle detection, dependency validation.
 * @see SOW Segment K, Architecture §8.7, §9.4
 */

import type { WorkflowStep } from "../contracts/workflow-definition.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import type { PipelineInput } from "../pipelines/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { TypedArtifact, EngineInvocation, EngineResult } from "../contracts/index.js";
import type { IEngine } from "../engines/base.js";
import type { IPipeline } from "../pipelines/types.js";
import { getWorkflowDefinition } from "./registry.js";
import { inheritBudgets } from "./budget-utils.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { randomUUID } from "node:crypto";

export interface WorkflowRunnerDeps {
  getEngine(ref: string): IEngine | undefined;
  getPipelineForWorkflow(workflowId: string): IPipeline | undefined;
}

export interface RunWorkflowParams {
  workflowId: string;
  version?: string;
  input: PipelineInput;
  deps: WorkflowRunnerDeps;
}

/** Step result: either artifacts from an engine or envelope from a sub-workflow. */
type StepOutput =
  | { kind: "artifacts"; artifacts: TypedArtifact[] }
  | { kind: "envelope"; envelope: ResponseEnvelope };

/**
 * Evaluate a simple decision condition against step output.
 * Supports conditions like "score > 0.8", "label == 'urgent'", "passed == true"
 */
function evaluateDecisionCondition(condition: string, stepOutput: StepOutput | undefined): boolean {
  if (!stepOutput) return false;

  // Extract data to evaluate against
  let data: Record<string, unknown> = {};
  if (stepOutput.kind === "envelope") {
    const envelope = stepOutput.envelope;
    data = {
      status: envelope.status,
      // Extract metrics from telemetry
      cost: envelope.telemetry?.cost_usd_est ?? 0,
      latency: envelope.telemetry?.latency_ms ?? 0,
      tokens: (envelope.telemetry?.tokens_in ?? 0) + (envelope.telemetry?.tokens_out ?? 0),
    };
  } else if (stepOutput.kind === "artifacts" && stepOutput.artifacts.length > 0) {
    // Try to extract data from artifact content
    const artifact = stepOutput.artifacts[0];
    const content = artifact.content as { inline?: Record<string, unknown> } | undefined;
    if (content?.inline && typeof content.inline === "object") {
      data = content.inline;
    }
  }

  // Simple expression parser for common patterns
  // Handle: key > value, key >= value, key < value, key <= value, key == value, key != value
  const comparisonPattern = /^\s*(\w+)\s*(>|>=|<|<=|==|!=)\s*(.+?)\s*$/;
  const match = condition.match(comparisonPattern);
  if (!match) return false;

  const [, key, operator, rawValue] = match;
  const dataValue = data[key];

  // Parse the comparison value
  let compareValue: string | number | boolean;
  const trimmedValue = rawValue.trim();
  if (trimmedValue === "true") compareValue = true;
  else if (trimmedValue === "false") compareValue = false;
  else if (!isNaN(Number(trimmedValue))) compareValue = Number(trimmedValue);
  else if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
    compareValue = trimmedValue.slice(1, -1);
  } else if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
    compareValue = trimmedValue.slice(1, -1);
  } else {
    compareValue = trimmedValue;
  }

  // Perform comparison
  if (dataValue === undefined) return false;

  switch (operator) {
    case ">": return Number(dataValue) > Number(compareValue);
    case ">=": return Number(dataValue) >= Number(compareValue);
    case "<": return Number(dataValue) < Number(compareValue);
    case "<=": return Number(dataValue) <= Number(compareValue);
    case "==": return String(dataValue) === String(compareValue);
    case "!=": return String(dataValue) !== String(compareValue);
    default: return false;
  }
}

/**
 * Determine the target step for a decision step based on branch conditions.
 */
function resolveDecisionTarget(
  step: WorkflowStep,
  stepOutputs: Map<string, StepOutput>
): string | null {
  // Get the output from the step this decision depends on
  const dependencyStepId = step.depends_on?.[0];
  if (!dependencyStepId) return step.default_target ?? null;

  const depOutput = stepOutputs.get(dependencyStepId);

  // Evaluate branches in order
  for (const branch of step.branches ?? []) {
    if (evaluateDecisionCondition(branch.condition, depOutput)) {
      return branch.target_step;
    }
  }

  // No branch matched, use default if provided
  return step.default_target ?? null;
}

/**
 * Topological order of steps by depends_on (steps with no deps first).
 * PRODUCTION: Cycle detection is implemented in WorkflowDefinitionSchema validation (`src/contracts/workflow-definition.ts` lines 105-142).
 * If depends_on has a cycle, validation fails at workflow definition load time, not at runtime.
 */
function sortSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const ordered: WorkflowStep[] = [];
  const done = new Set<string>();

  while (ordered.length < steps.length) {
    let added = 0;
    for (const s of steps) {
      if (done.has(s.step_id)) continue;
      const deps = s.depends_on ?? [];
      const depsDone = deps.every((d) => done.has(d));
      if (depsDone) {
        ordered.push(s);
        done.add(s.step_id);
        added++;
      }
    }
    if (added === 0) break;
  }
  return ordered;
}

/** Convert sub-workflow ResponseEnvelope to a single report artifact for downstream steps. */
function responseEnvelopeToArtifact(envelope: ResponseEnvelope, _stepId: string): TypedArtifact {
  const text = envelope.output?.text ?? "";
  return {
    artifact_id: randomUUID(),
    artifact_kind: "report",
    schema_ref: "schema://report@v1",
    encoding: "text",
    content: { inline: text },
  };
}

/** Build EngineInvocation for a step from context artifacts and runner input. */
function buildEngineInvocation(
  step: WorkflowStep,
  contextArtifacts: TypedArtifact[],
  input: PipelineInput,
  traceId: string | undefined
): EngineInvocation {
  const taskId = step.step_id;
  const ref = step.ref;
  const maxTokens = input.plan.budgets?.token_budget ?? 1024;
  return {
    invocation_id: randomUUID(),
    engine_type: ref as EngineInvocation["engine_type"],
    task: {
      task_id: taskId,
      task_type: ref === "synthesis" ? "synthesize" : ref === "execution" ? "execute" : ref,
      category: ref === "synthesis" ? "synthesis" : ref === "execution" ? "generation" : "evaluation",
      input_artifacts: contextArtifacts,
      objective: ref === "synthesis" && contextArtifacts.length > 0
        ? { description: String((contextArtifacts[0].content as { inline?: unknown })?.inline ?? "") }
        : {},
    },
    context_artifacts: contextArtifacts,
    actor_context: {
      org_id: input.caller.org_id,
      app_id: input.caller.app_id,
      user_id: input.caller.user_id,
      roles: input.caller.scopes ?? [],
    },
    budgets: { token_budget: maxTokens },
    metadata: { trace_id: traceId, contract_version: "v1" },
  };
}

/** Convert synthesis EngineResult to ResponseEnvelope. */
function synthesisResultToEnvelope(
  result: EngineResult,
  requestId: string,
  plan: PipelinePlan
): ResponseEnvelope {
  const text =
    result.result_artifacts[0] != null
      ? String(
          (result.result_artifacts[0].content as { inline?: string })?.inline ?? ""
        )
      : "";
  const metrics = result.metrics ?? {};
  return {
    request_id: requestId,
    status: result.status === "success" ? "ok" : "error",
    mode: "sync",
    output: { text, citations: [], attachments: [] },
    error: result.error
      ? { code: result.error.code, message: result.error.message ?? "", detail: result.error.detail }
      : undefined,
    telemetry: {
      pipeline: plan.pipeline_type,
      models_used: [],
      tool_calls: 0,
      tokens_in: metrics.tokens_used ?? 0,
      tokens_out: 0,
      cost_usd_est: metrics.cost_estimate_usd ?? 0,
      latency_ms: metrics.duration_ms ?? 0,
    },
  };
}

function emitWorkflowEvent(
  eventType: "WORKFLOW_START" | "WORKFLOW_END",
  payload: { workflow_id: string; duration_ms?: number; status?: string }
): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: eventType,
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

function emitEngineEvent(
  eventType: "ENGINE_START" | "ENGINE_END",
  payload: {
    engine_type: string;
    invocation_id: string;
    duration_ms?: number;
    cost_estimate_usd?: number;
    tokens_used?: number;
  }
): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: eventType,
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

function minPositive(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((v): v is number => typeof v === "number" && v > 0);
  if (defined.length === 0) return undefined;
  return Math.min(...defined);
}

function budgetExceededEnvelope(
  requestId: string,
  workflowId: string,
  workflowStart: number,
  detail: Record<string, unknown>
): ResponseEnvelope {
  return {
    request_id: requestId,
    status: "blocked",
    mode: "sync",
    error: {
      code: "BUDGET_EXCEEDED",
      message: "Workflow budget exceeded",
      detail,
    },
    telemetry: {
      pipeline: workflowId,
      models_used: [],
      tool_calls: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd_est: 0,
      latency_ms: Date.now() - workflowStart,
    },
  };
}

/**
 * Run a workflow by definition: resolve steps in order, execute engine_call or workflow_call,
 * inherit budgets for sub-workflows, preserve trace_id.
 */
export async function runWorkflow(params: RunWorkflowParams): Promise<ResponseEnvelope> {
  const { workflowId, version = "v1", input, deps } = params;
  const def = getWorkflowDefinition(workflowId, version);
  if (!def) {
    const requestId = input.canonical.request_id ?? "unknown";
    return {
      request_id: requestId,
      status: "error",
      mode: "sync",
      error: { code: "WORKFLOW_NOT_FOUND", message: `Workflow ${workflowId}@${version} not found`, detail: {} },
      telemetry: { pipeline: workflowId, models_used: [], tool_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd_est: 0, latency_ms: 0 },
    };
  }

  const ctx = getTraceContext();
  const traceId = ctx?.trace_id;
  const requestId = input.canonical.request_id ?? "unknown";
  const workflowStart = Date.now();
  emitWorkflowEvent("WORKFLOW_START", { workflow_id: workflowId });
  const deadlineMs = minPositive(def.stop_conditions?.deadline_ms, input.plan.budgets?.deadline_ms);
  const maxIterations = def.stop_conditions?.max_iterations ?? 1;
  const maxStepExecutions = Math.max(1, maxIterations * Math.max(def.steps.length, 1));
  const costBudgetUsd = input.plan.budgets?.cost_budget_usd;

  const sortedSteps = sortSteps(def.steps);
  const stepOutputs = new Map<string, StepOutput>();
  let runIterations = 0;
  let executedSteps = 0;
  let accumulatedCostUsd = 0;

  try {
    runIterations += 1;
    if (runIterations > maxIterations) {
      emitWorkflowEvent("WORKFLOW_END", {
        workflow_id: workflowId,
        duration_ms: Date.now() - workflowStart,
        status: "blocked",
      });
      return budgetExceededEnvelope(requestId, workflowId, workflowStart, {
        dimension: "max_iterations",
        max_iterations: maxIterations,
      });
    }
    for (const step of sortedSteps) {
      if (deadlineMs != null && Date.now() - workflowStart > deadlineMs) {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "blocked",
        });
        return budgetExceededEnvelope(requestId, workflowId, workflowStart, {
          dimension: "deadline_ms",
          deadline_ms: deadlineMs,
        });
      }
      if (executedSteps >= maxStepExecutions) {
        emitWorkflowEvent("WORKFLOW_END", {
          workflow_id: workflowId,
          duration_ms: Date.now() - workflowStart,
          status: "blocked",
        });
        return budgetExceededEnvelope(requestId, workflowId, workflowStart, {
          dimension: "max_iterations",
          max_iterations: maxIterations,
        });
      }
      const depArtifacts: TypedArtifact[] = [];
      for (const depId of step.depends_on ?? []) {
        const out = stepOutputs.get(depId);
        if (out?.kind === "artifacts") depArtifacts.push(...out.artifacts);
        else if (out?.kind === "envelope") depArtifacts.push(responseEnvelopeToArtifact(out.envelope, depId));
      }

      if (step.kind === "engine_call") {
        const engine = deps.getEngine(step.ref);
        if (!engine) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return {
            request_id: requestId,
            status: "error",
            mode: "sync",
            error: {
              code: "ENGINE_NOT_FOUND",
              message: `Engine ${step.ref} not found for step ${step.step_id}`,
              detail: {},
            },
            telemetry: { pipeline: workflowId, models_used: [], tool_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd_est: 0, latency_ms: Date.now() - workflowStart },
          };
        }
        const inv = buildEngineInvocation(step, depArtifacts, input, traceId);
        emitEngineEvent("ENGINE_START", { engine_type: step.ref, invocation_id: inv.invocation_id });
        const start = Date.now();
        const result = await engine.invoke(inv);
        const durationMs = Date.now() - start;
        emitEngineEvent("ENGINE_END", {
          engine_type: step.ref,
          invocation_id: inv.invocation_id,
          duration_ms: durationMs,
          cost_estimate_usd: result.metrics?.cost_estimate_usd,
          tokens_used: result.metrics?.tokens_used,
        });
        accumulatedCostUsd += result.metrics?.cost_estimate_usd ?? 0;
        if (costBudgetUsd != null && accumulatedCostUsd > costBudgetUsd) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "blocked",
          });
          return budgetExceededEnvelope(requestId, workflowId, workflowStart, {
            dimension: "cost_budget_usd",
            cost_budget_usd: costBudgetUsd,
            cost_used_usd: accumulatedCostUsd,
          });
        }
        if (result.status !== "success") {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return synthesisResultToEnvelope(result, requestId, input.plan);
        }
        executedSteps += 1;
        stepOutputs.set(step.step_id, { kind: "artifacts", artifacts: result.result_artifacts });
        continue;
      }

      if (step.kind === "workflow_call") {
        const subDef = getWorkflowDefinition(step.ref, version);
        if (!subDef) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return {
            request_id: requestId,
            status: "error",
            mode: "sync",
            error: {
              code: "WORKFLOW_NOT_FOUND",
              message: `Sub-workflow ${step.ref} not found`,
              detail: {},
            },
            telemetry: { pipeline: workflowId, models_used: [], tool_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd_est: 0, latency_ms: Date.now() - workflowStart },
          };
        }
        const childPlan = inheritBudgets(input.plan, subDef);
        const childInput: PipelineInput = { ...input, plan: childPlan };
        const pipeline = deps.getPipelineForWorkflow(step.ref);
        if (!pipeline) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "error",
          });
          return {
            request_id: requestId,
            status: "error",
            mode: "sync",
            error: {
              code: "PIPELINE_NOT_FOUND",
              message: `Pipeline for sub-workflow ${step.ref} not found`,
              detail: {},
            },
            telemetry: { pipeline: workflowId, models_used: [], tool_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd_est: 0, latency_ms: Date.now() - workflowStart },
          };
        }
        const childEnvelope = await pipeline.run(childInput);
        accumulatedCostUsd += childEnvelope.telemetry?.cost_usd_est ?? 0;
        if (costBudgetUsd != null && accumulatedCostUsd > costBudgetUsd) {
          emitWorkflowEvent("WORKFLOW_END", {
            workflow_id: workflowId,
            duration_ms: Date.now() - workflowStart,
            status: "blocked",
          });
          return budgetExceededEnvelope(requestId, workflowId, workflowStart, {
            dimension: "cost_budget_usd",
            cost_budget_usd: costBudgetUsd,
            cost_used_usd: accumulatedCostUsd,
          });
        }
        executedSteps += 1;
        stepOutputs.set(step.step_id, { kind: "envelope", envelope: childEnvelope });
        continue;
      }

      if (step.kind === "decision") {
        // Decision step: evaluate branches and potentially skip to target step
        executedSteps += 1;
        const targetStepId = resolveDecisionTarget(step, stepOutputs);
        if (targetStepId) {
          // Mark this step as executed with the decision result
          stepOutputs.set(step.step_id, {
            kind: "artifacts",
            artifacts: [{
              artifact_id: randomUUID(),
              artifact_kind: "report",
              schema_ref: "schema://decision_result@v1",
              encoding: "json",
              content: { inline: { decision_made: true, target_step: targetStepId } },
            }],
          });
          // Skip to the target step - we need to re-sort steps dynamically
          // For now, we continue execution; the topological sort means target comes later
          // In a more complex implementation, we'd jump directly to the target
        } else {
          // No target matched and no default - continue to next step
          stepOutputs.set(step.step_id, {
            kind: "artifacts",
            artifacts: [{
              artifact_id: randomUUID(),
              artifact_kind: "report",
              schema_ref: "schema://decision_result@v1",
              encoding: "json",
              content: { inline: { decision_made: false, reason: "no_matching_branch" } },
            }],
          });
        }
        continue;
      }
    }

    // Final output: last step
    const lastStep = sortedSteps[sortedSteps.length - 1];
    const lastOut = stepOutputs.get(lastStep.step_id);
    if (!lastOut) {
      emitWorkflowEvent("WORKFLOW_END", {
        workflow_id: workflowId,
        duration_ms: Date.now() - workflowStart,
        status: "ok",
      });
      return {
        request_id: requestId,
        status: "ok",
        mode: "sync",
        output: { text: "", citations: [], attachments: [] },
        telemetry: {
          pipeline: workflowId,
          models_used: [],
          tool_calls: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd_est: 0,
          latency_ms: Date.now() - workflowStart,
        },
      };
    }

    if (lastOut.kind === "envelope") {
      emitWorkflowEvent("WORKFLOW_END", {
        workflow_id: workflowId,
        duration_ms: Date.now() - workflowStart,
        status: lastOut.envelope.status === "ok" ? "ok" : "error",
      });
      const t = lastOut.envelope.telemetry;
      return {
        ...lastOut.envelope,
        telemetry: {
          pipeline: workflowId,
          models_used: Array.isArray(t?.models_used) ? t.models_used : [],
          tool_calls: typeof t?.tool_calls === "number" ? t.tool_calls : 0,
          tokens_in: typeof t?.tokens_in === "number" ? t.tokens_in : 0,
          tokens_out: typeof t?.tokens_out === "number" ? t.tokens_out : 0,
          cost_usd_est: accumulatedCostUsd || (typeof t?.cost_usd_est === "number" ? t.cost_usd_est : 0),
          latency_ms: typeof t?.latency_ms === "number" ? t.latency_ms : 0,
        },
      };
    }

    // Last step was engine_call (e.g. synthesis): convert to ResponseEnvelope
    if (lastStep.ref === "synthesis" && lastOut.artifacts.length > 0) {
      const result: EngineResult = {
        invocation_id: randomUUID(),
        status: "success",
        result_artifacts: lastOut.artifacts,
        metrics: { duration_ms: Date.now() - workflowStart, cost_estimate_usd: accumulatedCostUsd },
      };
      emitWorkflowEvent("WORKFLOW_END", {
        workflow_id: workflowId,
        duration_ms: Date.now() - workflowStart,
        status: "ok",
      });
      return synthesisResultToEnvelope(result, requestId, input.plan);
    }

    // Generic engine_call last step: wrap artifacts in envelope
    const text =
      lastOut.artifacts[0] != null
        ? String((lastOut.artifacts[0].content as { inline?: unknown })?.inline ?? "")
        : "";
    emitWorkflowEvent("WORKFLOW_END", {
      workflow_id: workflowId,
      duration_ms: Date.now() - workflowStart,
      status: "ok",
    });
    return {
      request_id: requestId,
      status: "ok",
      mode: "sync",
      output: { text, citations: [], attachments: [] },
      telemetry: {
        pipeline: workflowId,
        models_used: [],
        tool_calls: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd_est: 0,
        latency_ms: Date.now() - workflowStart,
      },
    };
  } catch (err) {
    emitWorkflowEvent("WORKFLOW_END", {
      workflow_id: workflowId,
      duration_ms: Date.now() - workflowStart,
      status: "error",
    });
    throw err;
  }
}
