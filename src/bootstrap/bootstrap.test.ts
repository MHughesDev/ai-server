/**
 * Bootstrap smoke test – deterministic startup and getConfig.
 */

import { bootstrap, getConfig, resetConfigForTest } from "./index.js";

describe("bootstrap", () => {
  it("returns config and allows getConfig", () => {
    const config = bootstrap();
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    expect(config.flags).toBeDefined();
    expect(getConfig()).toBe(config);
  });

  it("is idempotent", () => {
    const a = bootstrap();
    const b = bootstrap();
    expect(a).toBe(b);
  });
});

describe("getConfig", () => {
  it("returns same config as bootstrap()", () => {
    bootstrap();
    expect(getConfig()).toBe(bootstrap());
  });
});

describe("resetConfigForTest", () => {
  it("clears config cache so getConfig throws until next bootstrap", () => {
    bootstrap();
    resetConfigForTest();
    expect(() => getConfig()).toThrow("bootstrap() must be called");
    bootstrap();
    expect(getConfig()).toBeDefined();
  });
});
