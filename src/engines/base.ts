/**
 * Engine base – universal interface for all engines.
 * @see Architecture §8.6, §9.5; SOW §2.2
 * Rule: No file under `src/engines/` (except `registry.ts`) may import another engine module.
 * Enforced by `engine-architecture-invariants.test.ts` (WANT-005).
 */

import type { EngineInvocation, EngineResult } from "../contracts/index.js";

export interface IEngine {
  invoke(inv: EngineInvocation): Promise<EngineResult>;
}
