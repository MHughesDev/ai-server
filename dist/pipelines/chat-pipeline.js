/**
 * Chat pipeline – reactive_chat path via Model Gateway.
 * @see Docs/SPEC/14_Pipelines_Catalog.md, L2-02 Phase 1, L2-06 retrieval context
 */
export function createChatPipeline(gateway) {
    return {
        async run(input) {
            const { canonical, plan, retrievalContext } = input;
            const maxTokens = plan.budgets?.token_budget ?? 1024;
            const basePrompt = canonical.text || "(no input)";
            const prompt = retrievalContext?.contextText && retrievalContext.contextText.length > 0
                ? `Context:\n${retrievalContext.contextText}\n\nQuestion: ${basePrompt}`
                : basePrompt;
            const result = await gateway.complete({
                prompt,
                max_tokens: maxTokens,
                model: plan.models?.executor,
            });
            const citations = retrievalContext?.citations?.length
                ? retrievalContext.citations.map((c) => ({
                    source: c.source,
                    ref: c.ref,
                    span: c.span,
                }))
                : [];
            return {
                request_id: canonical.request_id,
                status: "ok",
                mode: "sync",
                output: {
                    text: result.text,
                    citations,
                },
                telemetry: {
                    pipeline: plan.pipeline_type,
                    models_used: [result.model],
                    tool_calls: 0,
                    tokens_in: result.tokens_in,
                    tokens_out: result.tokens_out,
                    cost_usd_est: result.cost_usd_est ?? 0,
                    latency_ms: result.latency_ms ?? 0,
                },
            };
        },
    };
}
//# sourceMappingURL=chat-pipeline.js.map