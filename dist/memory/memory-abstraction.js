/**
 * Memory abstraction – governed interface for retrieval and write-back.
 * @see Docs/SPEC/17_MemoryAbstraction_Spec.md
 */
/**
 * Scope check: whether a request scope is allowed to access data for given scope_keys.
 * Enforces user/project/org boundaries (org can see project/user; project can see user; user only self).
 */
export function scopeAllowsAccess(requestScope, requestScopeKeys, chunkScope, chunkScopeKeys) {
    if (requestScope === "none")
        return false;
    if (chunkScope === "none")
        return false;
    const hierarchy = {
        user: 1,
        project: 2,
        org: 3,
        none: 0,
    };
    const reqLevel = hierarchy[requestScope];
    const chunkLevel = hierarchy[chunkScope];
    if (reqLevel < chunkLevel)
        return false;
    if (requestScope === "user") {
        return (chunkScopeKeys["user_id"] !== undefined &&
            chunkScopeKeys["user_id"] === requestScopeKeys["user_id"]);
    }
    if (requestScope === "project") {
        const userMatch = chunkScopeKeys["user_id"] === undefined ||
            chunkScopeKeys["user_id"] === requestScopeKeys["user_id"];
        const projectMatch = chunkScopeKeys["project_id"] !== undefined &&
            chunkScopeKeys["project_id"] === requestScopeKeys["project_id"];
        return userMatch && projectMatch;
    }
    if (requestScope === "org") {
        const orgMatch = chunkScopeKeys["org_id"] !== undefined &&
            chunkScopeKeys["org_id"] === requestScopeKeys["org_id"];
        return orgMatch;
    }
    return false;
}
//# sourceMappingURL=memory-abstraction.js.map