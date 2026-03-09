/**
 * Memory Gateway – composes vector (IMemoryStore), structured, and object stores with scope and retention.
 * L2-06 Segment I: Single facade for vector + structured + object store backends.
 * @see Architecture §12, Docs/SPEC/17_MemoryAbstraction_Spec.md
 */

import type { IMemoryStore, IStructuredStore, IObjectStore } from "./memory-abstraction.js";
import type { MemoryRetentionConfig } from "../config/schema.js";

export interface MemoryGatewayOptions {
  /** Vector store for retrieval/ingest; or use vectorStoreGetter for a live reference (e.g. default store). */
  vectorStore?: IMemoryStore;
  /** When set, vectorStore is resolved by calling this each time (so setDefaultStore() is respected). */
  vectorStoreGetter?: () => IMemoryStore;
  structuredStore: IStructuredStore;
  objectStore: IObjectStore;
  retention?: MemoryRetentionConfig;
}

/**
 * Gateway holding vector store (retrieval/ingest), structured store (key-value by scope), and object store (blobs).
 * Scope and retention are enforced by each store; this type is the single composition point.
 */
export interface IMemoryGateway {
  readonly vectorStore: IMemoryStore;
  readonly structuredStore: IStructuredStore;
  readonly objectStore: IObjectStore;
  readonly retention: MemoryRetentionConfig | undefined;
}

/**
 * Create a memory gateway with the given stores and optional retention config.
 * Use vectorStoreGetter when the vector store may be replaced (e.g. tests calling setDefaultStore).
 */
export function createMemoryGateway(options: MemoryGatewayOptions): IMemoryGateway {
  const { structuredStore, objectStore, retention } = options;
  return {
    get vectorStore(): IMemoryStore {
      if (options.vectorStoreGetter) return options.vectorStoreGetter();
      if (options.vectorStore) return options.vectorStore;
      throw new Error("MemoryGateway: provide vectorStore or vectorStoreGetter");
    },
    get structuredStore(): IStructuredStore {
      return structuredStore;
    },
    get objectStore(): IObjectStore {
      return objectStore;
    },
    get retention(): MemoryRetentionConfig | undefined {
      return retention;
    },
  };
}
