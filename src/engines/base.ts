/**
 * Engine base – universal interface for all engines.
 * @see Architecture §8.6, §9.5; SOW §2.2
 * Rule: No file under src/engines/ may import another under src/engines/ for invoking an engine.
 */

import type { EngineInvocation, EngineResult } from "../contracts/index.js";

export interface IEngine {
  invoke(inv: EngineInvocation): Promise<EngineResult>;
}
