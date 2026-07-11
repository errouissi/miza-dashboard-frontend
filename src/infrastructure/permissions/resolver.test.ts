import { describe, expect, it } from "vitest";
import { createPermissionResolver } from "./resolver";

describe("permission resolver", () => {
  const resolver = createPermissionResolver(["villes.view", "villes.create"]);

  it("resolves a granted permission", () => {
    expect(resolver.has("villes.view")).toBe(true);
  });

  it("refuses an absent permission", () => {
    expect(resolver.has("villes.delete")).toBe(false);
  });

  it("resolves hasAny / hasAll", () => {
    expect(resolver.hasAny(["villes.delete", "villes.view"])).toBe(true);
    expect(resolver.hasAny(["villes.delete"])).toBe(false);
    expect(resolver.hasAll(["villes.view", "villes.create"])).toBe(true);
    expect(resolver.hasAll(["villes.view", "villes.delete"])).toBe(false);
  });

  it("grants nothing when no permissions are held", () => {
    const empty = createPermissionResolver();
    expect(empty.has("villes.view")).toBe(false);
    expect(empty.hasAny(["villes.view"])).toBe(false);
    // hasAll of an empty list is vacuously true — assert it so nobody "fixes" it later.
    expect(empty.hasAll([])).toBe(true);
  });
});
