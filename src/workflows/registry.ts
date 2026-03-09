/**
 * Workflow registry – loads WorkflowDefinition by workflow_id and version.
 * @see Architecture §8.7, §9.4; SOW §2.3
 */

import type { WorkflowDefinition } from "../contracts/workflow-definition.js";
import { validateWorkflowDefinition } from "../contracts/index.js";

const definitions = new Map<string, WorkflowDefinition>();

function register(def: WorkflowDefinition): void {
  const key = `${def.workflow_id}@${def.version}`;
  definitions.set(key, def);
}

/** Load and register reactive_chat from definitions (runtime or bundled). */
function loadReactiveChat(): void {
  // Inline minimal definition to avoid Node ESM JSON import complexity; can be replaced by fs read or build-time import.
  const reactiveChat: WorkflowDefinition = {
    workflow_id: "reactive_chat",
    version: "v1",
    entry_conditions: { intents: ["query", "chat"], required_capabilities: {} },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s1"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 60000 },
  };
  validateWorkflowDefinition(reactiveChat);
  register(reactiveChat);
}

loadReactiveChat();

/** Register coding_agent workflow (M3: planning → execution ↔ tool ↔ evaluation → synthesis). */
function loadCodingAgent(): void {
  const codingAgent: WorkflowDefinition = {
    workflow_id: "coding_agent",
    version: "v1",
    entry_conditions: {
      intents: ["coding", "task"],
      required_capabilities: { needs_tools: [] },
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "tool", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s2"] },
      { step_id: "s4", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s3"] },
    ],
    stop_conditions: { max_iterations: 3, deadline_ms: 120000 },
  };
  validateWorkflowDefinition(codingAgent);
  register(codingAgent);
}

loadCodingAgent();

/** Register deep_research workflow (M5: planning → execution ↔ tool ↔ evaluation → synthesis:report). */
function loadDeepResearch(): void {
  const deepResearch: WorkflowDefinition = {
    workflow_id: "deep_research",
    version: "v1",
    entry_conditions: {
      intents: ["query", "research"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s2"] },
    ],
    stop_conditions: { max_iterations: 2, deadline_ms: 90_000 },
  };
  validateWorkflowDefinition(deepResearch);
  register(deepResearch);
}

loadDeepResearch();

/** Register decision workflow (M5: planning → execution(options) → evaluation(score) → synthesis(decision memo)). */
function loadDecision(): void {
  const decision: WorkflowDefinition = {
    workflow_id: "decision",
    version: "v1",
    entry_conditions: {
      intents: ["query", "decision", "recommendation"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s2"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 60_000 },
  };
  validateWorkflowDefinition(decision);
  register(decision);
}

loadDecision();

/** Register composite_example workflow (M6: workflow_call to reactive_chat, then synthesis). */
function loadCompositeExample(): void {
  const composite: WorkflowDefinition = {
    workflow_id: "composite_example",
    version: "v1",
    entry_conditions: {
      intents: ["query", "chat"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "workflow_call", ref: "reactive_chat", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s1"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 60_000 },
  };
  validateWorkflowDefinition(composite);
  register(composite);
}

loadCompositeExample();

/** Segment M: Tool Automation – classification → planning → tool* → evaluation → synthesis (Architecture §11.4). */
function loadToolAutomation(): void {
  const def: WorkflowDefinition = {
    workflow_id: "tool_automation",
    version: "v1",
    entry_conditions: {
      intents: ["automation", "task"],
      required_capabilities: { needs_tools: [] },
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "classification", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "planning", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "tool", input_mapping: {}, depends_on: ["s2"] },
      { step_id: "s4", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s3"] },
      { step_id: "s5", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s4"] },
    ],
    stop_conditions: { max_iterations: 2, deadline_ms: 60_000 },
  };
  validateWorkflowDefinition(def);
  register(def);
}
loadToolAutomation();

/** Segment M: Extraction & Normalization – classification → execution(extract) → evaluation(schema) → synthesis (Architecture §11.6). */
function loadExtraction(): void {
  const def: WorkflowDefinition = {
    workflow_id: "extraction",
    version: "v1",
    entry_conditions: {
      intents: ["query", "extraction", "normalization"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "classification", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s2"] },
      { step_id: "s4", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s3"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 45_000 },
  };
  validateWorkflowDefinition(def);
  register(def);
}
loadExtraction();

/** Segment M: Verification / Audit – execution → evaluation(verification) → execution(repair) → synthesis (Architecture §11.7). */
function loadVerification(): void {
  const def: WorkflowDefinition = {
    workflow_id: "verification",
    version: "v1",
    entry_conditions: {
      intents: ["query", "verification", "audit"],
      required_capabilities: { needs_verification: true },
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: ["s2"] },
      { step_id: "s4", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s3"] },
    ],
    stop_conditions: { max_iterations: 2, deadline_ms: 90_000 },
  };
  validateWorkflowDefinition(def);
  register(def);
}
loadVerification();

/** Segment M: Planning-only – planning → evaluation(plan quality) → synthesis(plan) (Architecture §11.8). */
function loadPlanningOnly(): void {
  const def: WorkflowDefinition = {
    workflow_id: "planning_only",
    version: "v1",
    entry_conditions: {
      intents: ["query", "planning"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "planning", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s2"] },
    ],
    stop_conditions: { max_iterations: 1, deadline_ms: 30_000 },
  };
  validateWorkflowDefinition(def);
  register(def);
}
loadPlanningOnly();

/** Segment M: Batch Analysis – planning → (execution ↔ evaluation)* → synthesis(report) (Architecture §11.9). */
function loadBatchAnalysis(): void {
  const def: WorkflowDefinition = {
    workflow_id: "batch_analysis",
    version: "v1",
    entry_conditions: {
      intents: ["query", "batch", "analysis"],
      required_capabilities: {},
    },
    steps: [
      { step_id: "s1", kind: "engine_call", ref: "planning", input_mapping: {}, depends_on: [] },
      { step_id: "s2", kind: "engine_call", ref: "execution", input_mapping: {}, depends_on: ["s1"] },
      { step_id: "s3", kind: "engine_call", ref: "evaluation", input_mapping: {}, depends_on: ["s2"] },
      { step_id: "s4", kind: "engine_call", ref: "synthesis", input_mapping: {}, depends_on: ["s3"] },
    ],
    stop_conditions: { max_iterations: 2, deadline_ms: 120_000 },
  };
  validateWorkflowDefinition(def);
  register(def);
}
loadBatchAnalysis();

/**
 * Get a workflow definition by id and optional version (default v1).
 */
export function getWorkflowDefinition(workflowId: string, version = "v1"): WorkflowDefinition | undefined {
  return definitions.get(`${workflowId}@${version}`);
}

/**
 * Register a workflow definition (e.g. loaded from workflows/definitions/*.json).
 */
export function registerWorkflowDefinition(def: WorkflowDefinition): void {
  validateWorkflowDefinition(def);
  register(def);
}

/** List registered workflow IDs (version-agnostic) for policy/catalog alignment checks. */
export function listRegisteredWorkflowIds(): string[] {
  const ids = new Set<string>();
  for (const key of definitions.keys()) {
    const at = key.indexOf("@");
    ids.add(at >= 0 ? key.slice(0, at) : key);
  }
  return [...ids].sort();
}
