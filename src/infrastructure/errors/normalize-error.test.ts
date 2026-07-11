import { describe, expect, it } from "vitest";
import { normalizeError } from "./normalize-error";
import { AppError } from "./app-error";

/**
 * Fixtures mirror the backend's REAL envelopes (see BonExceptionRenderer and
 * AuthorizationExceptionRenderer). They are not invented — a normalizer tested
 * against imagined shapes proves only that the imagination is self-consistent.
 */
const httpFailure = (status: number, data: unknown) => ({ response: { status, data } });

describe("normalizeError — envelope-based discrimination (Decision 1)", () => {
  it("classifies a domain error on 409", () => {
    const error = normalizeError(
      httpFailure(409, {
        success: false,
        code: "BON_NOT_DRAFT",
        message: "Le bon n'est plus modifiable.",
        context: { bon_id: 42 },
      }),
    );

    expect(error.kind).toBe("domain");
    expect(error.code).toBe("BON_NOT_DRAFT");
    expect(error.context).toEqual({ bon_id: 42 });
  });

  it("classifies a domain error that arrives on 422 as DOMAIN, not validation", () => {
    // The case that makes envelope-discrimination necessary: the backend returns
    // BON_LINE_DUPLICATE_PRODUCT and BON_NUMBER_DUPLICATE with status 422 and NO
    // `errors` object. A status-based normalizer would try to field-map it, find
    // nothing, and render a form that silently does nothing.
    const error = normalizeError(
      httpFailure(422, {
        success: false,
        code: "BON_LINE_DUPLICATE_PRODUCT",
        message: "Produit déjà présent.",
      }),
    );

    expect(error.kind).toBe("domain");
    expect(error.code).toBe("BON_LINE_DUPLICATE_PRODUCT");
    expect(error.fieldErrors).toBeUndefined();
  });

  it("classifies a Laravel ValidationException on 422 as validation", () => {
    const error = normalizeError(
      httpFailure(422, {
        message: "The given data was invalid.",
        errors: { name: ["Le nom est obligatoire."] },
      }),
    );

    expect(error.kind).toBe("validation");
    expect(error.fieldErrors).toEqual({ name: ["Le nom est obligatoire."] });
    expect(error.code).toBeUndefined();
  });

  it("survives a domain envelope with NO context key", () => {
    // The backend omits `context` entirely when empty, by explicit contract.
    // A normalizer that assumes it exists throws here.
    const error = normalizeError(
      httpFailure(409, {
        success: false,
        code: "BON_NOT_EDITABLE",
        message: "Non modifiable.",
      }),
    );

    expect(error.kind).toBe("domain");
    expect(error.context).toBeUndefined();
  });

  it("classifies AUTHORIZATION_DENIED as permission, not domain", () => {
    const error = normalizeError(
      httpFailure(403, {
        success: false,
        code: "AUTHORIZATION_DENIED",
        message: "Authorization denied.",
      }),
    );

    expect(error.kind).toBe("permission");
  });

  it("classifies a coded 404 as notfound", () => {
    const error = normalizeError(
      httpFailure(404, {
        success: false,
        code: "BON_NOT_FOUND",
        message: "Introuvable.",
      }),
    );

    expect(error.kind).toBe("notfound");
    expect(error.code).toBe("BON_NOT_FOUND");
  });

  it("classifies a bare 401 as auth", () => {
    // Laravel's default: { message: "Unauthenticated." } — no code, no errors.
    const error = normalizeError(httpFailure(401, { message: "Unauthenticated." }));
    expect(error.kind).toBe("auth");
  });

  it("classifies a 500 as server", () => {
    expect(normalizeError(httpFailure(500, "<html>oops</html>")).kind).toBe("server");
  });

  it("classifies a response-less failure as network", () => {
    const error = normalizeError({ message: "Network Error" });
    expect(error.kind).toBe("network");
    expect(error.isRetryable).toBe(true);
  });

  it("marks 4xx as NOT retryable and 5xx/network as retryable", () => {
    expect(normalizeError(httpFailure(403, {})).isRetryable).toBe(false);
    expect(normalizeError(httpFailure(422, { errors: {} })).isRetryable).toBe(false);
    expect(normalizeError(httpFailure(500, {})).isRetryable).toBe(true);
  });

  it("preserves the correlation id", () => {
    const error = normalizeError(httpFailure(500, {}), { requestId: "req-123" });
    expect(error.requestId).toBe("req-123");
  });

  it("passes an existing AppError through untouched", () => {
    const original = new AppError({ kind: "domain", code: "X" });
    expect(normalizeError(original)).toBe(original);
  });
});
