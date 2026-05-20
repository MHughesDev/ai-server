/**
 * Production connection / concurrency limit guards (PR-021).
 */

import { assertProductionConnectionLimits as assertLimits } from "./connection-limits.js";

/** Fail fast when production would run without explicit resource caps. */
export function assertProductionConnectionLimits(): void {
  assertLimits();
}
