/**
 * Structured store – key-value records scoped by scope_keys.
 * L2-06 Segment I: In-memory implementation for dev/tests; swap for persistent backend in production.
 * @see docs/SPEC/17_MemoryAbstraction_Spec.md
 */

import type { IStructuredStore } from "./memory-abstraction.js";
import { scopeAllowsAccess } from "./memory-abstraction.js";
import type { StructuredRecord, RetrievalScope } from "./types.js";

function scopeKey(scope: RetrievalScope, scope_keys: Record<string, string>): string {
  const parts = [scope, ...Object.entries(scope_keys).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)];
  return parts.join(":");
}

/** In-memory structured store; enforces scope on get/put/delete/list. */
export class InMemoryStructuredStore implements IStructuredStore {
  private records = new Map<string, StructuredRecord>();

  private storageKey(scope: RetrievalScope, scope_keys: Record<string, string>, key: string): string {
    return `${scopeKey(scope, scope_keys)}:${key}`;
  }

  async get(
    key: string,
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<StructuredRecord | null> {
    await Promise.resolve();
    for (const record of this.records.values()) {
      if (record.key !== key) continue;
      if (scopeAllowsAccess(scope, scope_keys, record.scope, record.scope_keys)) return record;
    }
    return null;
  }

  async put(
    record: Omit<StructuredRecord, "created_at"> & { created_at?: string }
  ): Promise<void> {
    await Promise.resolve();
    const created_at = record.created_at ?? new Date().toISOString();
    const sk = this.storageKey(record.scope, record.scope_keys, record.key);
    this.records.set(sk, {
      ...record,
      created_at,
    });
  }

  async delete(
    key: string,
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<boolean> {
    await Promise.resolve();
    const sk = this.storageKey(scope, scope_keys, key);
    const existing = this.records.get(sk);
    if (!existing) return false;
    if (!scopeAllowsAccess(scope, scope_keys, existing.scope, existing.scope_keys)) return false;
    this.records.delete(sk);
    return true;
  }

  async list(
    scope: RetrievalScope,
    scope_keys: Record<string, string>
  ): Promise<StructuredRecord[]> {
    await Promise.resolve();
    const out: StructuredRecord[] = [];
    for (const record of this.records.values()) {
      if (scopeAllowsAccess(scope, scope_keys, record.scope, record.scope_keys)) {
        out.push(record);
      }
    }
    return out;
  }

  /** Test hook: clear all records. */
  clear(): void {
    this.records.clear();
  }
}
