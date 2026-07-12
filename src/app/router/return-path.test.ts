import { describe, expect, it } from "vitest";
import { buildLoginPath, isSafeReturnPath, readReturnPath } from "./return-path";

describe("return path", () => {
  it("accepts an in-app path", () => {
    expect(isSafeReturnPath("/money/cheques?status=pending")).toBe(true);
  });

  it("REJECTS an absolute URL — this is the open-redirect guard", () => {
    expect(isSafeReturnPath("https://evil.example/harvest")).toBe(false);
    expect(isSafeReturnPath("http://evil.example")).toBe(false);
  });

  it("REJECTS a protocol-relative URL", () => {
    // The one people miss: browsers read "//evil.example" as an external host, so a
    // naive startsWith("/") check lets it straight through.
    expect(isSafeReturnPath("//evil.example/harvest")).toBe(false);
  });

  it("rejects the login route itself, preventing a redirect loop", () => {
    expect(isSafeReturnPath("/login")).toBe(false);
    expect(isSafeReturnPath("/login?next=/x")).toBe(false);
  });

  it("rejects empty and missing values", () => {
    expect(isSafeReturnPath("")).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
  });

  it("builds a login path carrying a safe return target", () => {
    expect(buildLoginPath("/stock/bons")).toBe("/login?next=%2Fstock%2Fbons");
  });

  it("omits the return target entirely when it is unsafe", () => {
    expect(buildLoginPath("https://evil.example")).toBe("/login");
    expect(buildLoginPath(null)).toBe("/login");
  });

  it("re-validates a return path read back from the URL", () => {
    // The value arrives from the address bar, which is user-controlled. Whatever we
    // wrote there, we do not trust what we read back.
    expect(readReturnPath("?next=%2Fmoney%2Fcheques")).toBe("/money/cheques");
    expect(readReturnPath("?next=https%3A%2F%2Fevil.example")).toBeNull();
    expect(readReturnPath("?next=%2F%2Fevil.example")).toBeNull();
    expect(readReturnPath("")).toBeNull();
  });
});
