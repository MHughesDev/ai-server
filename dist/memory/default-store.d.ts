/**
 * Default memory store for the server – in-memory implementation.
 * Swap for vector DB adapter in production when provisioned.
 * @see L2-06, Docs/SPEC/17
 */
import type { IMemoryStore } from "./memory-abstraction.js";
/**
 * Return the default memory store (lazy singleton). Used by query-handler and tests.
 */
export declare function getDefaultStore(): IMemoryStore;
/**
 * Replace default store (e.g. for tests or production vector DB).
 */
export declare function setDefaultStore(store: IMemoryStore | null): void;
//# sourceMappingURL=default-store.d.ts.map