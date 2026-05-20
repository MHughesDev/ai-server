/**
 * Production model gateway guards (PR-002 / WANT-023).
 */

import type { Config } from "./schema.js";

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

  const openAiProviders = config.model_gateway.providers.filter(
    (p) => p.kind === "openai_compatible"
  );
  if (openAiProviders.length === 0) {
    throw new Error(
      "Production requires at least one model_gateway provider with kind openai_compatible (set MODEL_GATEWAY_PROVIDERS_JSON). Stub/framed_echo-only defaults are for dev/staging (WANT-023)."
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
}
