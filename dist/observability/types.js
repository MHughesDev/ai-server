/**
 * Observability – tracing, metrics, structured logs.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04
 */
let observabilityInstance = null;
/** Set the global observability instance (e.g. from bootstrap or server). */
export function setObservability(obs) {
    observabilityInstance = obs;
}
/** Get the global observability instance. */
export function getObservability() {
    return observabilityInstance;
}
//# sourceMappingURL=types.js.map