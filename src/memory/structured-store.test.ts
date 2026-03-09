/**
 * Unit tests for InMemoryStructuredStore – scope enforcement and CRUD.
 */

import { InMemoryStructuredStore } from "./structured-store.js";

describe("InMemoryStructuredStore", () => {
  let store: InMemoryStructuredStore;

  beforeEach(() => {
    store = new InMemoryStructuredStore();
  });

  it("puts and gets a record with user scope", async () => {
    await store.put({
      key: "prefs",
      scope: "user",
      scope_keys: { user_id: "u1" },
      value: { theme: "dark" },
    });
    const got = await store.get("prefs", "user", { user_id: "u1" });
    expect(got).not.toBeNull();
    expect(got!.key).toBe("prefs");
    expect(got!.value).toEqual({ theme: "dark" });
  });

  it("returns null for get when scope cannot access", async () => {
    await store.put({
      key: "prefs",
      scope: "user",
      scope_keys: { user_id: "u2" },
      value: { theme: "light" },
    });
    const got = await store.get("prefs", "user", { user_id: "u1" });
    expect(got).toBeNull();
  });

  it("org scope can read user-scoped record in same org", async () => {
    await store.put({
      key: "meta",
      scope: "user",
      scope_keys: { user_id: "u1", org_id: "o1" },
      value: { name: "alice" },
    });
    const got = await store.get("meta", "org", { org_id: "o1" });
    expect(got).not.toBeNull();
    expect(got!.value).toEqual({ name: "alice" });
  });

  it("list returns only records caller can access", async () => {
    await store.put({
      key: "a",
      scope: "org",
      scope_keys: { org_id: "o1" },
      value: 1,
    });
    await store.put({
      key: "b",
      scope: "org",
      scope_keys: { org_id: "o2" },
      value: 2,
    });
    const list = await store.list("org", { org_id: "o1" });
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe("a");
  });

  it("delete returns false when record not found or scope denied", async () => {
    await store.put({
      key: "x",
      scope: "user",
      scope_keys: { user_id: "u1" },
      value: 1,
    });
    const deletedOther = await store.delete("x", "user", { user_id: "u2" });
    expect(deletedOther).toBe(false);
    const got = await store.get("x", "user", { user_id: "u1" });
    expect(got).not.toBeNull();
    const deleted = await store.delete("x", "user", { user_id: "u1" });
    expect(deleted).toBe(true);
    expect(await store.get("x", "user", { user_id: "u1" })).toBeNull();
  });
});
