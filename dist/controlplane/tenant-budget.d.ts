/**
 * Tenant-level budget tracking – cross-request cost caps per org (L2-03 gap).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 shared budget counters
 */
/**
 * Record usage for a tenant (call after request completes).
 * Used for cross-request tenant cost caps.
 * PRODUCTION: Wrapped in try/catch to prevent audit failures from failing requests.
 */
export declare function recordTenantUsage(orgId: string, usage: {
    cost_usd?: number;
    tokens?: number;
}): Promise<void>;
/**
 * Check if tenant is within their hourly cost cap (before allowing request).
 * Returns { allowed: false } when cap is set and current window usage >= cap.
 */
export declare function checkTenantBudget(orgId: string): Promise<{
    allowed: boolean;
}>;
/** Reset tenant usage (for tests). */
export declare function resetTenantBudgets(): void;
//# sourceMappingURL=tenant-budget.d.ts.map