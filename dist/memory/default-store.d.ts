/**
 * Default memory store for the server – production-ready implementation with Redis support.
 * L2-06 Segment I: Memory gateway composes vector + structured + object stores; getDefaultStore returns gateway vector store.
 * @see L2-06, docs/SPEC/17_MemoryAbstraction_Spec.md
 */
import type { IMemoryStore } from "./memory-abstraction.js";
import type { IMemoryGateway } from "./memory-gateway.js";
/**
 * Return the default memory store (lazy singleton). Used by query-handler and tests.
 * This is the vector store from the memory gateway.
 * PRODUCTION: Supports Redis vector backend for production deployments.
 */
export declare function getDefaultStore(): IMemoryStore;
/**
 * Replace default store (e.g. for tests or production vector DB).
 * Invalidates the cached gateway so next getMemoryGateway() uses the new store.
 */
export declare function setDefaultStore(store: IMemoryStore | null): void;
/**
 * Return the memory gateway (vector + structured + object stores). Scope and retention enforced by each store.
 * Vector store is the same instance returned by getDefaultStore() so tests can setDefaultStore(mock) and use the gateway.
 */
export declare function getMemoryGateway(): IMemoryGateway;
//# sourceMappingURL=default-store.d.ts.map