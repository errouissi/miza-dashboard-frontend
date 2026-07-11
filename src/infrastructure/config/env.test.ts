import { describe, expect, it } from "vitest";
import { loadConfig } from "./env";

const validEnv = {
  MODE: "development",
  VITE_API_BASE_URL: "http://127.0.0.1:8000/api/v1",
};

describe("loadConfig", () => {
  it("accepts a valid environment", () => {
    const config = loadConfig(validEnv);
    expect(config.environment).toBe("development");
    expect(config.apiBaseUrl).toBe("http://127.0.0.1:8000/api/v1");
  });

  it("fails fast when a required value is missing", () => {
    expect(() => loadConfig({ MODE: "development" })).toThrow(/cannot start/i);
  });

  it("fails fast when a required value is malformed", () => {
    expect(() => loadConfig({ ...validEnv, VITE_API_BASE_URL: "not-a-url" })).toThrow(
      /absolute URL/i,
    );
  });

  it("refuses a test configuration that points at a real backend", () => {
    expect(() =>
      loadConfig({ MODE: "test", VITE_API_BASE_URL: "https://api.miza.example/api/v1" }),
    ).toThrow(/never point at a real backend/i);
  });

  it("keeps production defaults conservative", () => {
    const production = loadConfig({ ...validEnv, MODE: "production" });
    expect(production.features.devtools).toBe(false);
    expect(production.features.environmentBanner).toBe(false);
    expect(production.features.errorReporting).toBe(true);
  });

  it("makes staging mirror production, but visibly marked", () => {
    const staging = loadConfig({ ...validEnv, MODE: "staging" });
    expect(staging.features.errorReporting).toBe(true);
    expect(staging.features.devtools).toBe(false);
    expect(staging.features.environmentBanner).toBe(true);
  });
});
