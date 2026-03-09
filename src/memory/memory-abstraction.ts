/**
 * Memory abstraction – governed interface for retrieval and write-back.
 * @see docs/SPEC/17_MemoryAbstraction_Spec.md
 * L2-06 Segment I: Structured and object store interfaces for gateway expansion.
 */

import type {
  RetrievalRequest,
  RetrievalResult,
  RetrievalScope,
  IngestionInput,
  IngestionResult,
  StructuredRecord,
  ObjectBlob,
} from "./types.js";

/**
 * Scope check: whether a request scope is allowed to access data for given scope_keys.
 * Enforces user/project/org boundaries (org can see project/user; project can see user; user only self).
 */
export function scopeAllowsAccess(
  requestScope: RetrievalScope,
  requestScopeKeys: Record<string, string>,
  chunkScope: RetrievalScope,
  chunkScopeKeys: Record<string, string>
): boolean {
  if (requestScope === "none") return false;
  if (chunkScope === "none") return false;
  const hierarchy: Record<RetrievalScope, number> = {
    user: 1,
    project: 2,
    org: 3,
    none: 0,
  };
  const reqLevel = hierarchy[requestScope];
  const chunkLevel = hierarchy[chunkScope];
  if (reqLevel < chunkLevel) return false;
  if (requestScope === "user") {
    return (
      chunkScopeKeys["user_id"] !== undefined &&
      chunkScopeKeys["user_id"] === requestScopeKeys["user_id"]
    );
  }
  if (requestScope === "project") {
    const userMatch =
      chunkScopeKeys["user_id"] === undefined ||
      chunkScopeKeys["user_id"] === requestScopeKeys["user_id"];
    const projectMatch =
      chunkScopeKeys["project_id"] !== undefined &&
      chunkScopeKeys["project_id"] === requestScopeKeys["project_id"];
    return userMatch && projectMatch;
  }
  if (requestScope === "org") {
    const orgMatch =
      chunkScopeKeys["org_id"] !== undefined &&
      chunkScopeKeys["org_id"] === requestScopeKeys["org_id"];
    return orgMatch;
  }
  return false;
}

/** Memory store interface – retrieval and optional ingestion (vector/semantic store). */
export interface IMemoryStore {
  /** Retrieve with scope enforcement. Returns empty hits and degraded flag when unavailable. */
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
  /** Ingest document chunks (optional; not all stores support). */
  ingest?(input: IngestionInput): Promise<IngestionResult>;
  /** Health check for fallback decision. */
  isAvailable?(): Promise<boolean>;
}

/** L2-06 Segment I: Structured store – key-value records by scope. */
export interface IStructuredStore {
  get(key: string, scope: RetrievalScope, scope_keys: Record<string, string>): Promise<StructuredRecord | null>;
  put(record: Omit<StructuredRecord, "created_at"> & { created_at?: string }): Promise<void>;
  delete(key: string, scope: RetrievalScope, scope_keys: Record<string, string>): Promise<boolean>;
  list(scope: RetrievalScope, scope_keys: Record<string, string>): Promise<StructuredRecord[]>;
}

/** L2-06 Segment I: Object store – blobs by id and scope. */
export interface IObjectStore {
  get(id: string, scope: RetrievalScope, scope_keys: Record<string, string>): Promise<ObjectBlob | null>;
  put(blob: Omit<ObjectBlob, "created_at"> & { created_at?: string }): Promise<void>;
  delete(id: string, scope: RetrievalScope, scope_keys: Record<string, string>): Promise<boolean>;
  list(scope: RetrievalScope, scope_keys: Record<string, string>): Promise<Pick<ObjectBlob, "id" | "content_type" | "created_at">[]>;
}
