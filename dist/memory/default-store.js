/**
 * Default memory store for the server – in-memory implementation.
 * Swap for vector DB adapter in production when provisioned.
 * @see L2-06, Docs/SPEC/17
 */
import { InMemoryStore } from "./in-memory-store.js";
let defaultStore = null;
/**
 * Return the default memory store (lazy singleton). Used by query-handler and tests.
 */
export function getDefaultStore() {
    if (!defaultStore) {
        defaultStore = new InMemoryStore();
    }
    return defaultStore;
}
/**
 * Replace default store (e.g. for tests or production vector DB).
 */
export function setDefaultStore(store) {
    defaultStore = store;
}
//# sourceMappingURL=default-store.js.map