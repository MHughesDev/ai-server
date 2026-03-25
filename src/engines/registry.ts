/**
 * Engine registry – map engine ref (e.g. "execution", "synthesis") to IEngine.
 * Used by workflow runner for engine_call steps. Individual engines use at most one gateway
 * (or memory store); wiring lives here — see `engine-architecture-invariants.test.ts` (WANT-005).
 * @see SOW M6 Segment K, Architecture §9.5
 */

import type { IEngine } from "./base.js";
import type { IModelGateway } from "../gateways/types.js";
import type { IToolGateway } from "../gateways/types.js";
import type { IMemoryStore } from "../memory/memory-abstraction.js";
import { createExecutionEngine } from "./execution_engine.js";
import { createSynthesisEngine } from "./synthesis_engine.js";
import { createClassificationEngine } from "./classification_engine.js";
import { createEvaluationEngine } from "./evaluation_engine.js";
import { createToolEngine } from "./tool_engine.js";
import { createMemoryEngine } from "./memory_engine.js";
import { createPlanningEngine } from "./planning_engine.js";
import { createCondensingEngine } from "./condensing_engine.js";

export interface EngineRegistryOptions {
  modelGateway: IModelGateway;
  toolGateway?: IToolGateway;
  memoryStore?: IMemoryStore;
  /** Allowlist for tool engine when used from runner (optional). */
  toolsAllowlist?: string[];
}

const ENGINE_REFS = [
  "execution",
  "synthesis",
  "classification",
  "evaluation",
  "tool",
  "memory",
  "planning",
  "condensing",
] as const;

export type EngineRef = (typeof ENGINE_REFS)[number];

function isEngineRef(ref: string): ref is EngineRef {
  return (ENGINE_REFS as readonly string[]).includes(ref);
}

/**
 * Create a registry that returns IEngine for known refs.
 * Engines are created once; tool and memory engines only exist when gateways are provided.
 */
export function createEngineRegistry(options: EngineRegistryOptions): (ref: string) => IEngine | undefined {
  const { modelGateway, toolGateway, memoryStore, toolsAllowlist } = options;
  const execution = createExecutionEngine(modelGateway);
  const synthesis = createSynthesisEngine(modelGateway);
  const classification = createClassificationEngine({ modelGateway });
  const evaluation = createEvaluationEngine({ modelGateway, evaluationModel: "gpt-4o-mini" });
  const planning = createPlanningEngine(modelGateway);
  const condensing = createCondensingEngine(modelGateway);
  const tool =
    toolGateway != null
      ? createToolEngine(toolGateway, { allowlist: toolsAllowlist })
      : undefined;
  const memory = memoryStore != null ? createMemoryEngine(memoryStore) : undefined;

  return (ref: string): IEngine | undefined => {
    if (!isEngineRef(ref)) return undefined;
    switch (ref) {
      case "execution":
        return execution;
      case "synthesis":
        return synthesis;
      case "classification":
        return classification;
      case "evaluation":
        return evaluation;
      case "tool":
        return tool;
      case "memory":
        return memory;
      case "planning":
        return planning;
      case "condensing":
        return condensing;
      default:
        return undefined;
    }
  };
}
