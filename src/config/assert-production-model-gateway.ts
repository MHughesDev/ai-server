/**
 * Production model gateway guards (PR-002 / WANT-023).
 */

import {
  resolveModelRoute,
  type ModelCapabilityRegistry,
  type ModelRouteConfig,
  type ModelSelectionContext,
} from "../gateways/model-routing.js";
import type { Config } from "./schema.js";

export type ModelProviderKind = "stub" | "framed_echo" | "openai_compatible";

export interface ModelProviderRef {
  id: string;
  kind: ModelProviderKind;
}

/** Provider kinds that do not call a real model API (dev/test only). */
export const SYNTHETIC_MODEL_PROVIDER_KINDS = ["stub", "framed_echo"] as const;

export type SyntheticModelProviderKind = (typeof SYNTHETIC_MODEL_PROVIDER_KINDS)[number];

export function isSyntheticModelProviderKind(
  kind: ModelProviderKind
): kind is SyntheticModelProviderKind {
  return kind === "stub" || kind === "framed_echo";
}

function resolveRoutedProvider(
  providers: ModelProviderRef[],
  registry: ModelCapabilityRegistry,
  selection: ModelSelectionContext,
  fallbackRoute: ModelRouteConfig
): { route: ModelRouteConfig; provider: ModelProviderRef | undefined } {
  const route = resolveModelRoute(registry, selection, fallbackRoute);
  const provider = providers.find((p) => p.id === route.provider);
  return { route, provider };
}

/**
 * Fail fast on the query path when production would route to stub/framed providers (WANT-023).
 */
export function assertRuntimeModelGateway(
  config: {
    env: Config["env"];
    providers: ModelProviderRef[];
    registry: ModelCapabilityRegistry;
    default_capability: string;
    defaultModel: string;
  },
  selection: ModelSelectionContext
): void {
  if (config.env !== "production") return;

  const fallbackProvider = config.providers[0];
  if (!fallbackProvider) {
    throw new Error("Production requires at least one configured model provider");
  }
  const fallbackRoute: ModelRouteConfig = {
    provider: fallbackProvider.id,
    model: config.defaultModel,
  };

  const { route, provider } = resolveRoutedProvider(
    config.providers,
    config.registry,
    selection,
    fallbackRoute
  );

  if (!provider || isSyntheticModelProviderKind(provider.kind)) {
    throw new ModelGatewayProductionError(
      `Production model route '${route.provider}' (${provider?.kind ?? "missing"}) is not openai_compatible. ` +
        "Configure MODEL_GATEWAY_PROVIDERS_JSON and MODEL_GATEWAY_REGISTRY_JSON for a real provider (WANT-023)."
    );
  }
}

export class ModelGatewayProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelGatewayProductionError";
  }
}

function resolveApiKeyForProvider(
  provider: Config["model_gateway"]["providers"][number]
): string | undefined {
  const inline = provider.api_key?.trim();
  if (inline) return inline;
  const envName = provider.api_key_env?.trim();
  if (!envName) return undefined;
  return process.env[envName]?.trim() || undefined;
}

/** Fail fast when production would still use stub/framed-only or unconfigured real providers. */
export function assertProductionModelGateway(config: Config): void {
  if (config.env !== "production") return;

  const syntheticInConfig = config.model_gateway.providers.filter((p) =>
    isSyntheticModelProviderKind(p.kind)
  );
  if (syntheticInConfig.length > 0) {
    throw new Error(
      `Production must not register stub/framed_echo model providers (found: ${syntheticInConfig.map((p) => `${p.id}:${p.kind}`).join(", ")}). Use openai_compatible only (WANT-023).`
    );
  }

  const openAiProviders = config.model_gateway.providers.filter(
    (p) => p.kind === "openai_compatible"
  );
  if (openAiProviders.length === 0) {
    throw new Error(
      "Production requires at least one model_gateway provider with kind openai_compatible (set MODEL_GATEWAY_PROVIDERS_JSON). Dev/staging defaults use framed_echo (WANT-023)."
    );
  }

  for (const provider of openAiProviders) {
    if (!provider.api_key_env?.trim() && !provider.api_key?.trim()) {
      throw new Error(
        `Production model provider '${provider.id}' must set api_key_env or api_key`
      );
    }
    if (!resolveApiKeyForProvider(provider)) {
      const envName = provider.api_key_env?.trim() ?? "api_key";
      throw new Error(
        `Production model provider '${provider.id}' is missing API key (set ${envName} or api_key)`
      );
    }
  }

  const capability = config.model_gateway.default_capability;
  const route =
    config.model_gateway.registry[capability]?.default ??
    config.model_gateway.registry.chat?.default;
  if (!route) {
    throw new Error(
      `Production requires MODEL_GATEWAY_REGISTRY_JSON with a default route for capability '${capability}'`
    );
  }

  const routedProvider = config.model_gateway.providers.find(
    (p) => p.id === route.provider
  );
  if (!routedProvider || routedProvider.kind !== "openai_compatible") {
    throw new Error(
      `Production registry must route '${capability}' default to an openai_compatible provider; got '${route.provider}' (${routedProvider?.kind ?? "unknown"})`
    );
  }

  assertRuntimeModelGateway(
    {
      env: config.env,
      providers: config.model_gateway.providers,
      registry: config.model_gateway.registry,
      default_capability: capability,
      defaultModel: config.model_gateway.default_model,
    },
    { capability }
  );
}
