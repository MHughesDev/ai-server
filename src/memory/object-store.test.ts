/**
 * Unit tests for InMemoryObjectStore – scope enforcement and CRUD.
 */

import { InMemoryObjectStore } from "./object-store.js";

describe("InMemoryObjectStore", () => {
  let store: InMemoryObjectStore;

  beforeEach(() => {
    store = new InMemoryObjectStore();
  });

  it("puts and gets a blob with user scope", async () => {
    await store.put({
      id: "doc-1",
      scope: "user",
      scope_keys: { user_id: "u1" },
      content: "hello world",
      content_type: "text/plain",
    });
    const got = await store.get("doc-1", "user", { user_id: "u1" });
    expect(got).not.toBeNull();
    expect(got!.id).toBe("doc-1");
    expect(got!.content).toBe("hello world");
  });

  it("returns null for get when scope cannot access", async () => {
    await store.put({
      id: "doc-2",
      scope: "user",
      scope_keys: { user_id: "u2" },
      content: "secret",
    });
    const got = await store.get("doc-2", "user", { user_id: "u1" });
    expect(got).toBeNull();
  });

  it("org scope can read user-scoped blob in same org", async () => {
    await store.put({
      id: "doc-3",
      scope: "user",
      scope_keys: { user_id: "u1", org_id: "o1" },
      content: "org-visible",
    });
    const got = await store.get("doc-3", "org", { org_id: "o1" });
    expect(got).not.toBeNull();
    expect(got!.content).toBe("org-visible");
  });

  it("list returns descriptors without content", async () => {
    await store.put({
      id: "doc-a",
      scope: "org",
      scope_keys: { org_id: "o1" },
      content: "content a",
      content_type: "text/plain",
    });
    const list = await store.list("org", { org_id: "o1" });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("doc-a");
    expect(list[0].content_type).toBe("text/plain");
    expect("content" in list[0]).toBe(false);
  });

  it("delete returns false when blob not found or scope denied", async () => {
    await store.put({
      id: "doc-d",
      scope: "user",
      scope_keys: { user_id: "u1" },
      content: "x",
    });
    expect(await store.delete("doc-d", "user", { user_id: "u2" })).toBe(false);
    expect(await store.delete("doc-d", "user", { user_id: "u1" })).toBe(true);
    expect(await store.get("doc-d", "user", { user_id: "u1" })).toBeNull();
  });
});
