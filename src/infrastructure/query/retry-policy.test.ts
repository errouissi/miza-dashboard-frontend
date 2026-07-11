import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { MUTATION_RETRY, queryRetryDelay, shouldRetryQuery } from "./retry-policy";

const err = (kind: AppError["kind"], status?: number) => new AppError({ kind, status });

describe("retry policy", () => {
  it("retries a 500 up to twice, then stops", () => {
    expect(shouldRetryQuery(0, err("server", 500))).toBe(true);
    expect(shouldRetryQuery(1, err("server", 500))).toBe(true);
    expect(shouldRetryQuery(2, err("server", 500))).toBe(false);
  });

  it("retries a network failure", () => {
    expect(shouldRetryQuery(0, err("network"))).toBe(true);
  });

  it("NEVER retries 4xx — a 403 or 404 is a fact, not a blip", () => {
    expect(shouldRetryQuery(0, err("permission", 403))).toBe(false);
    expect(shouldRetryQuery(0, err("notfound", 404))).toBe(false);
    expect(shouldRetryQuery(0, err("validation", 422))).toBe(false);
    expect(shouldRetryQuery(0, err("domain", 409))).toBe(false);
    expect(shouldRetryQuery(0, err("auth", 401))).toBe(false);
  });

  it("does not retry an un-normalized throw", () => {
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(false);
  });

  it("MUTATIONS NEVER RETRY", () => {
    // The money-critical assertion. A retried deposit validation may settle twice;
    // a retried approve may approve twice. The frontend does not get to assume the
    // backend is idempotent on an endpoint that moves money.
    expect(MUTATION_RETRY).toBe(false);
  });

  it("backs off exponentially, capped", () => {
    expect(queryRetryDelay(0)).toBe(300);
    expect(queryRetryDelay(1)).toBe(600);
    expect(queryRetryDelay(10)).toBe(3000);
  });
});
