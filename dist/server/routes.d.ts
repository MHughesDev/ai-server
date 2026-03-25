/**
 * HTTP route handlers – health, ready, metrics, version, query.
 * @see docs/SPEC/02_API_Contracts.md
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { type JobQueueService } from "../queue/job-queue.js";
export declare function setJobQueueService(service: JobQueueService | null): void;
export declare function getJobQueueService(): JobQueueService | null;
export declare function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=routes.d.ts.map