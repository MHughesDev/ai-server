import type { IModelGateway } from "./types.js";
import { jest } from "@jest/globals";
import { ModelGatewayProductionError } from "../config/assert-production-model-gateway.js";
import {
  classifyModelProviderFailure,
  createGatewayTimeoutError,
  createProviderBackedModelGateway,
  isRetryableModelProviderHttpStatus,
  ModelGatewayError,
  resolveModelRoute,
  withTimeoutAndRetry,
} from "./model-gateway.js";

describe("Model gateway routing", () => {
  it("resolves scope precedence user > app > org > default", () => {
    const registry = {
      chat: {
        default: { provider: "p-default", model: "m-default" },
        org: { o1: { provider: "p-org", model: "m-org" } },
        app: { a1: { provider: "p-app", model: "m-app" } },
        user: { u1: { provider: "p-user", model: "m-user" } },
      },
    };
    const route = resolveModelRoute(
      registry,
      { capability: "chat", org_id: "o1", app_id: "a1", user_id: "u1" },
      { provider: "fallback", model: "fallback" }
    );
    expect(route).toEqual({ provider: "p-user", model: "m-user" });
  });

  it("blocks synthetic providers when runtime_env is production (WANT-023)", () => {
    expect(() =>
      createProviderBackedModelGateway(
        {
          timeoutMs: 1_000,
          maxRetries: 0,
          defaultModel: "gpt-4o-mini",
          default_capability: "chat",
          runtime_env: "production",
          providers: [{ id: "framed", kind: "framed_echo", default_model: "framed-default" }],
          registry: {
            chat: { default: { provider: "framed", model: "framed-default" } },
          },
        },
        { capability: "chat" }
      )
    ).toThrow(ModelGatewayProductionError);
  });

  it("uses provider-backed gateway and selected registry model", async () => {
    const gateway = createProviderBackedModelGateway(
      {
        timeoutMs: 1_000,
        maxRetries: 0,
        defaultModel: "fallback-model",
        default_capability: "chat",
        providers: [{ id: "framed", kind: "framed_echo", default_model: "framed-default" }],
        registry: {
          chat: {
            org: {
              o1: { provider: "framed", model: "org-model" },
            },
          },
        },
      },
      { capability: "chat", org_id: "o1" }
    );
    const result = await gateway.complete({ prompt: "hello" });
    expect(result.model).toBe("org-model");
    expect(result.text).toContain("provider:framed");
  });
});

describe("isRetryableModelProviderHttpStatus", () => {
  it("treats rate limits, request timeout, and 5xx as retryable", () => {
    expect(isRetryableModelProviderHttpStatus(408)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(429)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(500)).toBe(true);
    expect(isRetryableModelProviderHttpStatus(503)).toBe(true);
  });

  it("does not retry typical client errors including 409 conflict", () => {
    expect(isRetryableModelProviderHttpStatus(400)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(401)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(403)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(404)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(409)).toBe(false);
    expect(isRetryableModelProviderHttpStatus(422)).toBe(false);
  });
});

describe("withTimeoutAndRetry", () => {
  it("retries retryable failures", async () => {
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValueOnce({ code: "MODEL_FAILURE", message: "transient" })
      .mockResolvedValue({
        text: "ok",
        tokens_in: 1,
        tokens_out: 1,
        model: "m1",
      });
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };

    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 1, timeoutMs: 1_000 });
    const result = await gateway.complete({ prompt: "x" });
    expect(result.text).toBe("ok");
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry provider invalid_api_key classified as AUTH_INVALID (WANT-026)", async () => {
    const failure = classifyModelProviderFailure(
      401,
      JSON.stringify({ error: { type: "invalid_request_error", code: "invalid_api_key" } })
    );
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValue(
        new ModelGatewayError("bad key", failure.code, failure.retryable)
      );
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };
    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 3, timeoutMs: 1_000 });

    await expect(gateway.complete({ prompt: "x" })).rejects.toMatchObject<ModelGatewayError>({
      code: "AUTH_INVALID",
      retryable: false,
    });
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable failures", async () => {
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValue({ code: "INVALID_PAYLOAD", message: "bad request" });
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };
    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 3, timeoutMs: 1_000 });

    await expect(gateway.complete({ prompt: "x" })).rejects.toMatchObject<ModelGatewayError>({
      code: "INVALID_PAYLOAD",
      retryable: false,
    });
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it("maps gateway timeout to MODEL_FAILURE via GatewayTimeoutError (WANT-027)", async () => {
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValue(createGatewayTimeoutError("model"));
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };
    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 0, timeoutMs: 1_000 });

    await expect(gateway.complete({ prompt: "x" })).rejects.toMatchObject<ModelGatewayError>({
      code: "MODEL_FAILURE",
      retryable: true,
      message: "Model gateway timeout",
    });
  });

  it("retries when the race hits the gateway timeout then delegate succeeds", async () => {
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 50, { text: "late", tokens_in: 1, tokens_out: 1, model: "m" }))
      )
      .mockResolvedValue({
        text: "ok",
        tokens_in: 1,
        tokens_out: 1,
        model: "m1",
      });
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };
    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 2, timeoutMs: 10 });
    const result = await gateway.complete({ prompt: "x" });
    expect(result.text).toBe("ok");
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it("retries TypeError fetch failures when classified transient", async () => {
    const completeMock = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue({
        text: "ok",
        tokens_in: 1,
        tokens_out: 1,
        model: "m1",
      });
    const delegate: IModelGateway = {
      complete: completeMock as unknown as IModelGateway["complete"],
    };
    const gateway = withTimeoutAndRetry(delegate, { maxRetries: 2, timeoutMs: 1_000 });
    const result = await gateway.complete({ prompt: "x" });
    expect(result.text).toBe("ok");
    expect(completeMock).toHaveBeenCalledTimes(2);
  });

  it("clears timeout timer on success and failure", async () => {
    const clearSpy = jest.spyOn(global, "clearTimeout");
    const successDelegate: IModelGateway = {
      complete: jest.fn().mockResolvedValue({ text: "ok", tokens_in: 1, tokens_out: 1, model: "m1" }),
    };
    const failDelegate: IModelGateway = {
      complete: jest.fn().mockRejectedValue({ code: "INVALID_PAYLOAD", message: "bad" }),
    };

    const successGateway = withTimeoutAndRetry(successDelegate, { maxRetries: 0, timeoutMs: 1_000 });
    const failGateway = withTimeoutAndRetry(failDelegate, { maxRetries: 0, timeoutMs: 1_000 });
    await successGateway.complete({ prompt: "x" });
    await expect(failGateway.complete({ prompt: "x" })).rejects.toBeInstanceOf(ModelGatewayError);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("leaves no pending timers on success path (PR-020)", async () => {
    jest.useFakeTimers();
    try {
      const delegate: IModelGateway = {
        complete: jest.fn().mockResolvedValue({
          text: "ok",
          tokens_in: 1,
          tokens_out: 1,
          model: "m1",
        }),
      };
      const gateway = withTimeoutAndRetry(delegate, { maxRetries: 0, timeoutMs: 1_000 });
      const result = await gateway.complete({ prompt: "x" });
      expect(result.text).toBe("ok");
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
