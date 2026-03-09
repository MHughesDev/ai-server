/**
 * Object store – blobs by id and scope (e.g. raw documents).
 * L2-06 Segment I: In-memory implementation for dev/tests; swap for persistent backend in production.
 * @see docs/SPEC/17_MemoryAbstraction_Spec.md
 */

import type { IObjectStore } from "./memory-abstraction.js";
import { scopeAllowsAccess } from "./memory-abstraction.js";
import type { ObjectBlob, RetrievalScope } from "./types.js";

function scopeKey(scope: RetrievalScope, scope_keys: Record<string, string>): string {
  const parts = [scope, ...Object.entries(scope_keys).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)];
  return parts.join(":");
}

/** In-memory object store; enforces scope on get/put/delete/list. */
export class InMemoryObjectStore implements IObjectStore {
  private blobs = new Map<string, ObjectBlob>();

  private storageKey(scope: RetrievalScope, scope_keys: Record<string, string>, id: string): string {
    return `${scopeKey(scope, scope_keys)}:${id}`;
  }

  async get(
    id: string,
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<ObjectBlob | null> {
    await Promise.resolve();
    for (const blob of this.blobs.values()) {
      if (blob.id !== id) continue;
      if (scopeAllowsAccess(scope, scope_keys, blob.scope, blob.scope_keys)) return blob;
    }
    return null;
  }

  async put(
    blob: Omit<ObjectBlob, "created_at"> & { created_at?: string }
  ): Promise<void> {
    await Promise.resolve();
    const created_at = blob.created_at ?? new Date().toISOString();
    const sk = this.storageKey(blob.scope, blob.scope_keys, blob.id);
    this.blobs.set(sk, {
      ...blob,
      created_at,
    });
  }

  async delete(
    id: string,
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<boolean> {
    await Promise.resolve();
    const sk = this.storageKey(scope, scope_keys, id);
    const existing = this.blobs.get(sk);
    if (!existing) return false;
    if (!scopeAllowsAccess(scope, scope_keys, existing.scope, existing.scope_keys)) return false;
    this.blobs.delete(sk);
    return true;
  }

  async list(
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<Pick<ObjectBlob, "id" | "content_type" | "created_at">[]> {
    await Promise.resolve();
    const out: Pick<ObjectBlob, "id" | "content_type" | "created_at">[] = [];
    for (const blob of this.blobs.values()) {
      if (scopeAllowsAccess(scope, scope_keys, blob.scope, blob.scope_keys)) {
        out.push({
          id: blob.id,
          content_type: blob.content_type,
          created_at: blob.created_at,
        });
      }
    }
    return out;
  }

  /** Test hook: clear all blobs. */
  clear(): void {
    this.blobs.clear();
  }
}
