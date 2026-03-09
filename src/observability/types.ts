/**
 * Observability – tracing, metrics, structured logs.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04
 */

import type { EventEmitter } from "./emitter.js";
import type { TraceContext } from "./context.js";

/** Observability interface: events + context */
export interface IObservability {
  events: EventEmitter;
  getContext(): TraceContext | undefined;
}

let observabilityInstance: IObservability | null = null;

/** Set the global observability instance (e.g. from bootstrap or server). */
export function setObservability(obs: IObservability | null): void {
  observabilityInstance = obs;
}

/** Get the global observability instance. */
export function getObservability(): IObservability | null {
  return observabilityInstance;
}
