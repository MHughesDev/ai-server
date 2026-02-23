/**
 * POST /v1/query handler – ingress → brain stem → policy → router → response.
 * @see L2-02 MVP runtime, L2-04 observability wiring
 */
import type { IngressResult } from "../ingress/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
/**
 * Handle validated query: canonicalize → intent → control plane (policy → budget → route) → dispatch gate → pipeline.
 * No pipeline runs without explicit allow and pipeline plan (L2-03 non-bypass).
 */
export declare function handleQuery(ingressResult: IngressResult): Promise<ResponseEnvelope>;
//# sourceMappingURL=query-handler.d.ts.map