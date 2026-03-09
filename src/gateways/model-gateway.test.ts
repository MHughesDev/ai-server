import type { IModelGateway } from "./types.js";
import { jest } from "@jest/globals";
import {
  createProviderBackedModelGateway,
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
});
