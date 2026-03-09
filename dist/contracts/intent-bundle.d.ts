/**
 * IntentBundle – internal Brain Stem output (intent + confidence + complexity).
 * @see docs/Overview.md, docs/Architecture_document_Finalized.md (6.2)
 */
import { z } from "zod";
declare const ComplexitySchema: z.ZodObject<{
    horizon: z.ZodOptional<z.ZodEnum<["single_step", "multi_step", "long_horizon"]>>;
    tool_likelihood: z.ZodOptional<z.ZodNumber>;
    retrieval_likelihood: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
    tool_likelihood?: number | undefined;
    retrieval_likelihood?: number | undefined;
}, {
    horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
    tool_likelihood?: number | undefined;
    retrieval_likelihood?: number | undefined;
}>;
declare const ConstraintsHintsSchema: z.ZodObject<{
    needs_web: z.ZodOptional<z.ZodBoolean>;
    needs_files: z.ZodOptional<z.ZodBoolean>;
    needs_code: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    needs_web?: boolean | undefined;
    needs_files?: boolean | undefined;
    needs_code?: boolean | undefined;
}, {
    needs_web?: boolean | undefined;
    needs_files?: boolean | undefined;
    needs_code?: boolean | undefined;
}>;
export declare const IntentBundleSchema: z.ZodObject<{
    intents: z.ZodArray<z.ZodString, "many">;
    confidence: z.ZodNumber;
    modalities_detected: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    complexity: z.ZodOptional<z.ZodObject<{
        horizon: z.ZodOptional<z.ZodEnum<["single_step", "multi_step", "long_horizon"]>>;
        tool_likelihood: z.ZodOptional<z.ZodNumber>;
        retrieval_likelihood: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
        tool_likelihood?: number | undefined;
        retrieval_likelihood?: number | undefined;
    }, {
        horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
        tool_likelihood?: number | undefined;
        retrieval_likelihood?: number | undefined;
    }>>;
    constraints_hints: z.ZodOptional<z.ZodObject<{
        needs_web: z.ZodOptional<z.ZodBoolean>;
        needs_files: z.ZodOptional<z.ZodBoolean>;
        needs_code: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        needs_web?: boolean | undefined;
        needs_files?: boolean | undefined;
        needs_code?: boolean | undefined;
    }, {
        needs_web?: boolean | undefined;
        needs_files?: boolean | undefined;
        needs_code?: boolean | undefined;
    }>>;
    /** Pipeline-style intent for routing (chat, rag, tool_agent, etc.) */
    primary_intent: z.ZodOptional<z.ZodEnum<["chat", "coding_agent", "rag", "tool_agent", "multimodal_reasoning"]>>;
    /** Risk flags for policy */
    risk_flags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    routing_hints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    intents: string[];
    confidence: number;
    modalities_detected: string[];
    risk_flags: string[];
    routing_hints: string[];
    complexity?: {
        horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
        tool_likelihood?: number | undefined;
        retrieval_likelihood?: number | undefined;
    } | undefined;
    constraints_hints?: {
        needs_web?: boolean | undefined;
        needs_files?: boolean | undefined;
        needs_code?: boolean | undefined;
    } | undefined;
    primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
}, {
    intents: string[];
    confidence: number;
    modalities_detected?: string[] | undefined;
    complexity?: {
        horizon?: "single_step" | "multi_step" | "long_horizon" | undefined;
        tool_likelihood?: number | undefined;
        retrieval_likelihood?: number | undefined;
    } | undefined;
    constraints_hints?: {
        needs_web?: boolean | undefined;
        needs_files?: boolean | undefined;
        needs_code?: boolean | undefined;
    } | undefined;
    primary_intent?: "chat" | "coding_agent" | "rag" | "tool_agent" | "multimodal_reasoning" | undefined;
    risk_flags?: string[] | undefined;
    routing_hints?: string[] | undefined;
}>;
export type IntentBundle = z.infer<typeof IntentBundleSchema>;
export type Complexity = z.infer<typeof ComplexitySchema>;
export type ConstraintsHints = z.infer<typeof ConstraintsHintsSchema>;
export {};
//# sourceMappingURL=intent-bundle.d.ts.map