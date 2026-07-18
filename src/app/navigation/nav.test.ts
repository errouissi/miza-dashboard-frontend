import { describe, expect, it } from "vitest";
import { PERMISSIONS, createPermissionResolver } from "@/infrastructure/permissions";
import { VILLES_PATH } from "@/domains/reference/villes";
import { NAV_TREE, filterNav, type NavGroup } from "./nav";

/**
 * Filtering itself is verified against a FIXTURE rather than the real tree, so
 * these cases stay stable as domains land. The real tree gets its own assertions
 * at the bottom — every item points at a registered permission and a real path.
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

  it("does not mutate the real tree either", () => {
    const before = JSON.stringify(NAV_TREE);
    filterNav(NAV_TREE, createPermissionResolver([]));
    expect(JSON.stringify(NAV_TREE)).toBe(before);
  });
});

describe("the real nav tree", () => {
  const registered = new Set<string>(Object.values(PERMISSIONS));

  it("contains the Villes entry, pointing at the resource's own path", () => {
    const items = NAV_TREE.flatMap((group) => group.items);
    const villes = items.find((item) => item.to === VILLES_PATH);

    expect(villes).toBeDefined();
    expect(villes?.permission).toBe(PERMISSIONS.ACCESS_DASHBOARD);
  });

  it("every item's permission comes from the central registry", () => {
    // The anti-drift assertion. A hand-typed permission string here would light
    // up a nav item leading to a route the guard refuses — the exact legacy
    // defect this registry exists to prevent.
    for (const item of NAV_TREE.flatMap((group) => group.items)) {
      expect(registered.has(item.permission)).toBe(true);
    }
  });

  it("is hidden entirely from a session holding no permissions", () => {
    expect(filterNav(NAV_TREE, createPermissionResolver([]))).toEqual([]);
  });

  it("is visible to a session holding access-dashboard", () => {
    const groups = filterNav(
      NAV_TREE,
      createPermissionResolver([PERMISSIONS.ACCESS_DASHBOARD]),
    );
    expect(groups.length).toBeGreaterThan(0);
  });
});
