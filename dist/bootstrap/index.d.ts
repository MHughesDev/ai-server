/**
 * Application bootstrap – deterministic startup and config validation.
 * @see L2-01 Phase 1: bootstrap path with startup checks
 */
import { type Config } from "../config/index.js";
/** Load and validate config; throws on invalid env. Call once at startup. */
export declare function bootstrap(): Config;
/** Return current config; must call bootstrap() first. */
export declare function getConfig(): Config;
/** Test-only: clear config cache so next bootstrap() reloads from env. Use in isolation tests (e.g. L2-06 retrieval). */
export declare function resetConfigForTest(): void;
//# sourceMappingURL=index.d.ts.map