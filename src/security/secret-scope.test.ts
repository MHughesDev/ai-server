/**
 * Secret scope unit tests – allow/deny by caller org/role/env.
 * @see L2-05 Phase 1, SEC-003
 */

import {
  isSecretAllowedForCaller,
  resolveSecret,
  SecretScopeViolationError,
} from "./secret-scope.js";
import type { CallerContext } from "./types.js";

const caller: CallerContext = {
  appId: "app1",
  userId: "user1",
  orgId: "org-A",
  scopes: ["read", "admin"],
};

describe("secret-scope", () => {
  describe("isSecretAllowedForCaller", () => {
    it("allows when scope is org_id and matches", () => {
      expect(isSecretAllowedForCaller({ key: "k", scope: "org-A" }, caller)).toBe(true);
    });

    it("denies when scope is org_id and does not match", () => {
      expect(isSecretAllowedForCaller({ key: "k", scope: "org-B" }, caller)).toBe(false);
    });

    it("denies empty scope", () => {
      expect(isSecretAllowedForCaller({ key: "k", scope: "" }, caller)).toBe(false);
    });

    it("allows when scope is role:name and caller has scope", () => {
      expect(isSecretAllowedForCaller({ key: "k", scope: "role:admin" }, caller)).toBe(true);
      expect(isSecretAllowedForCaller({ key: "k", scope: "role:read" }, caller)).toBe(true);
    });

    it("denies when scope is role:name and caller lacks scope", () => {
      expect(isSecretAllowedForCaller({ key: "k", scope: "role:write" }, caller)).toBe(false);
    });
  });

  describe("resolveSecret", () => {
    it("returns redacted placeholder when allowed", async () => {
      const value = await resolveSecret({ key: "api_key", scope: "org-A" }, caller);
      expect(value).toBe("[REDACTED]");
    });

    it("throws SecretScopeViolationError when denied", async () => {
      await expect(
        resolveSecret({ key: "api_key", scope: "org-B" }, caller)
      ).rejects.toThrow(SecretScopeViolationError);
    });

    it("throws includes ref and caller for audit", async () => {
      try {
        await resolveSecret({ key: "x", scope: "org-B" }, caller);
      } catch (e) {
        expect(e).toBeInstanceOf(SecretScopeViolationError);
        expect((e as SecretScopeViolationError).ref.scope).toBe("org-B");
        expect((e as SecretScopeViolationError).caller.orgId).toBe("org-A");
      }
    });
  });
});
