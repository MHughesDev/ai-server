/**
 * Chat pipeline – reactive_chat path via Execution + Synthesis engines.
 * @see docs/SPEC/14_Pipelines_Catalog.md, L2-02 Phase 1, SOW M1 – wire to engines
 * When plan.memory is set and memoryStore is provided, uses Memory Engine for retrieval (SOW M4).
 */
import type { IPipeline } from "./types.js";
import type { IModelGateway } from "../gateways/types.js";
import type { IMemoryStore } from "../memory/memory-abstraction.js";
export declare function createChatPipeline(gateway: IModelGateway, options?: {
    memoryStore?: IMemoryStore;
}): IPipeline;
//# sourceMappingURL=chat-pipeline.d.ts.map