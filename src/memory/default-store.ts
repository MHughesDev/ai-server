/**
 * Default memory store for the server – in-memory implementation.
 * Swap for vector DB adapter in production when provisioned.
 * @see L2-06, Docs/SPEC/17
 */

import type { IMemoryStore } from "./memory-abstraction.js";
import { InMemoryStore } from "./in-memory-store.js";

let defaultStore: IMemoryStore | null = null;

/**
 * Return the default memory store (lazy singleton). Used by query-handler and tests.
 */
export function getDefaultStore(): IMemoryStore {
  if (!defaultStore) {
    defaultStore = new InMemoryStore();
  }
  return defaultStore;
}

/**
 * Replace default store (e.g. for tests or production vector DB).
 */
export function setDefaultStore(store: IMemoryStore | null): void {
  defaultStore = store;
}
