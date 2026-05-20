/**
 * Model capability routing (shared by gateway and production guards).
 */

export interface ModelRouteConfig {
  provider: string;
  model: string;
}

export interface ModelCapabilityRegistry {
  [capability: string]: {
    default?: ModelRouteConfig;
    org?: Record<string, ModelRouteConfig>;
    app?: Record<string, ModelRouteConfig>;
    user?: Record<string, ModelRouteConfig>;
  };
}

export interface ModelSelectionContext {
  capability?: string;
  org_id?: string;
  app_id?: string;
  user_id?: string;
}

export function resolveModelRoute(
  registry: ModelCapabilityRegistry,
  selection: ModelSelectionContext,
  fallback: ModelRouteConfig
): ModelRouteConfig {
  const capability = selection.capability ?? "chat";
  const routesForCapability = registry[capability];
  if (!routesForCapability) return fallback;

  if (selection.user_id && routesForCapability.user?.[selection.user_id]) {
    return routesForCapability.user[selection.user_id];
  }
  if (selection.app_id && routesForCapability.app?.[selection.app_id]) {
    return routesForCapability.app[selection.app_id];
  }
  if (selection.org_id && routesForCapability.org?.[selection.org_id]) {
    return routesForCapability.org[selection.org_id];
  }
  return routesForCapability.default ?? fallback;
}
