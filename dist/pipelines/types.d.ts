/**
 * Pipelines – execution harnesses (chat, rag, tool_agent, etc.).
 * @see Docs/SPEC/14_Pipelines_Catalog.md, L2-06 retrieval context
 * @see contracts/agent-harness-contract.ts – data foundation for all harnesses
 */
import type { AgentHarnessInput, ResponseEnvelope } from "../contracts/index.js";
import type { CitationSpec } from "../memory/types.js";
/** Optional retrieval context when memory_retrieval_enabled and scope allows */
export interface RetrievalContext {
    contextText: string;
    citations: CitationSpec[];
}
/**
 * Input to a pipeline harness. Uses the agent harness contract so every harness
 * receives the same post-orchestration foundation (canonical, intent, policy, plan, caller, retrievalContext).
 */
export type PipelineInput = AgentHarnessInput;
/** Stub: execute pipeline and return ResponseEnvelope */
export interface IPipeline {
    run(input: PipelineInput): Promise<ResponseEnvelope>;
}
//# sourceMappingURL=types.d.ts.map