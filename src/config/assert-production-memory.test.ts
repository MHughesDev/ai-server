/**
 * Production memory assertion tests (PR-006).
 */

import { assertProductionMemory } from "./assert-production-memory.js";
import { loadConfigFromEnv } from "./schema.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

function productionConfig() {
  process.env.NODE_ENV = "production";
  return loadConfigFromEnv();
}

describe("assertProductionMemory", () => {
  it("allows vector backend with REDIS_URL", () => {
    process.env.MEMORY_BACKEND = "vector";
    process.env.REDIS_URL = "redis://redis:6379";
    expect(() => assertProductionMemory(productionConfig())).not.toThrow();
  });

  it("allows vector backend with CHROMA_URL", () => {
    process.env.MEMORY_BACKEND = "vector";
    process.env.CHROMA_URL = "http://chroma:8000";
    delete process.env.REDIS_URL;
    expect(() => assertProductionMemory(productionConfig())).not.toThrow();
  });

  it("throws when backend is in_memory", () => {
    process.env.MEMORY_BACKEND = "in_memory";
    process.env.REDIS_URL = "redis://redis:6379";
    expect(() => assertProductionMemory(productionConfig())).toThrow(/MEMORY_BACKEND=vector/);
  });

  it("throws when vector backend has no persistent URL", () => {
    process.env.MEMORY_BACKEND = "vector";
    delete process.env.REDIS_URL;
    delete process.env.CHROMA_URL;
    expect(() => assertProductionMemory(productionConfig())).toThrow(/REDIS_URL or CHROMA_URL/);
  });

  it("skips in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.MEMORY_BACKEND = "in_memory";
    expect(() => assertProductionMemory(loadConfigFromEnv())).not.toThrow();
  });
});
