/**
 * HTTP/HTTPS server – POST /v1/query, health, ready, metrics, version.
 * @see docs/SPEC/02_API_Contracts.md, L2-02
 */
import { type IncomingMessage, type ServerResponse } from "node:http";
export declare function createAppServer(): import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
export declare function createHttpsAppServer(options: {
    key: Buffer;
    cert: Buffer;
}): import("https").Server<typeof IncomingMessage, typeof ServerResponse>;
//# sourceMappingURL=index.d.ts.map