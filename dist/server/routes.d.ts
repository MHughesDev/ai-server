/**
 * HTTP route handlers – health, ready, metrics, version, query.
 * @see Docs/SPEC/02_API_Contracts.md
 */
import type { IncomingMessage, ServerResponse } from "node:http";
export declare function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=routes.d.ts.map