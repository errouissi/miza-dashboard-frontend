import { describe, expect, it } from "vitest";
import { createPermissionResolver } from "@/infrastructure/permissions";
import { NAV_TREE, filterNav, type NavGroup } from "./nav";

/**
 * The real NAV_TREE is empty in M1-B (no domains exist), so permission filtering is
 * verified against a fixture. A fixture is the honest way to test this: inventing
 * real nav entries would mean inventing routes and permission strings no backend
 * has agreed to.
 */
const fixture: NavGroup[] = [
  {
    label: "Money",
    items: [
      { label: "Cheques", to: "/money/cheques", permission: "cheques.view" },
      { label: "Deposits", to: "/money/deposits", permission: "deposits.view" },
    ],
  },
  {
    label: "Stock",
    items: [{ label: "Bons", to: "/stock/bons", permission: "bons.view" }],
  },
];

describe("filterNav", () => {
  it("keeps only the items the session holds a permission for", () => {
    const groups = filterNav(fixture, createPermissionResolver(["cheques.view"]));

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Money");
    expect(groups[0].items.map((i) => i.label)).toEqual(["Cheques"]);
  });

  it("DROPS a group whose every item is unpermitted", () => {
    // An empty group heading is a promise of navigation that isn't there.
    const groups = filterNav(fixture, createPermissionResolver(["bons.view"]));

    expect(groups.map((g) => g.label)).toEqual(["Stock"]);
  });

  it("renders nothing at all for a session with no permissions", () => {
    expect(filterNav(fixture, createPermissionResolver([]))).toEqual([]);
  });

  it("keeps everything when every permission is held", () => {
    const groups = filterNav(
      fixture,
      createPermissionResolver(["cheques.view", "deposits.view", "bons.view"]),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
  });

  it("does not mutate the source tree", () => {
    filterNav(fixture, createPermissionResolver([]));
    expect(fixture[0].items).toHaveLength(2);
  });

  it("the real nav tree is empty in M1-B — no domains exist yet", () => {
    expect(NAV_TREE).toEqual([]);
  });
});
