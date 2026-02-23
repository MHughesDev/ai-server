/**
 * Memory abstraction scope tests – L2-06 Phase 1, scope boundary
 */

import { scopeAllowsAccess } from "./memory-abstraction.js";

describe("scopeAllowsAccess", () => {
  it("denies when request scope is none", () => {
    expect(
      scopeAllowsAccess("none", {}, "user", { user_id: "u1" })
    ).toBe(false);
  });

  it("denies when chunk scope is none", () => {
    expect(
      scopeAllowsAccess("org", { org_id: "o1" }, "none", {})
    ).toBe(false);
  });

  it("user scope: allows only same user_id", () => {
    expect(
      scopeAllowsAccess("user", { user_id: "u1" }, "user", { user_id: "u1" })
    ).toBe(true);
    expect(
      scopeAllowsAccess("user", { user_id: "u1" }, "user", { user_id: "u2" })
    ).toBe(false);
  });

  it("project scope: allows same project_id and user", () => {
    expect(
      scopeAllowsAccess(
        "project",
        { project_id: "p1", user_id: "u1" },
        "project",
        { project_id: "p1", user_id: "u1" }
      )
    ).toBe(true);
    expect(
      scopeAllowsAccess(
        "project",
        { project_id: "p1", user_id: "u1" },
        "project",
        { project_id: "p2", user_id: "u1" }
      )
    ).toBe(false);
  });

  it("org scope: allows same org_id", () => {
    expect(
      scopeAllowsAccess("org", { org_id: "o1" }, "org", { org_id: "o1" })
    ).toBe(true);
    expect(
      scopeAllowsAccess("org", { org_id: "o1" }, "org", { org_id: "o2" })
    ).toBe(false);
  });

  it("org can access user-level chunk in same org", () => {
    expect(
      scopeAllowsAccess("org", { org_id: "o1" }, "user", { user_id: "u1", org_id: "o1" })
    ).toBe(true);
  });
});
