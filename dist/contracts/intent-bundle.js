/**
 * IntentBundle – internal Brain Stem output (intent + confidence + complexity).
 * @see docs/ARCHITECTURE/Overview.md, docs/ARCHITECTURE/Architecture_document_Finalized.md (6.2)
 */
import { z } from "zod";
const ComplexitySchema = z.object({
    horizon: z.enum(["single_step", "multi_step", "long_horizon"]).optional(),
    tool_likelihood: z.number().min(0).max(1).optional(),
    retrieval_likelihood: z.number().min(0).max(1).optional(),
});
const ConstraintsHintsSchema = z.object({
    needs_web: z.boolean().optional(),
    needs_files: z.boolean().optional(),
    needs_code: z.boolean().optional(),
});
export const IntentBundleSchema = z.object({
    intents: z.array(z.string()).min(1),
    confidence: z.number().min(0).max(1),
    modalities_detected: z.array(z.string()).default([]),
    complexity: ComplexitySchema.optional(),
    constraints_hints: ConstraintsHintsSchema.optional(),
    /** Pipeline-style intent for routing (chat, rag, tool_agent, etc.) */
    primary_intent: z
        .enum(["chat", "coding_agent", "rag", "tool_agent", "multimodal_reasoning"])
        .optional(),
    /** Risk flags for policy */
    risk_flags: z.array(z.string()).default([]),
    routing_hints: z.array(z.string()).default([]),
});
//# sourceMappingURL=intent-bundle.js.map