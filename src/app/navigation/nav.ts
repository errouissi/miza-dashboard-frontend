import type { LucideIcon } from "lucide-react";
import { Map, MapPin, CreditCard, ShieldCheck, UserCog } from "lucide-react";
import { PERMISSIONS, type PermissionResolver } from "@/infrastructure/permissions";
import { ADMINS_PATH } from "@/domains/network/admins";
import { MANAGERS_PATH } from "@/domains/network/managers";
import { PRODUCTS_PATH } from "@/domains/reference/products";
import { SECTEURS_PATH } from "@/domains/reference/secteurs";
import { VILLES_PATH } from "@/domains/reference/villes";

/**
 * The navigation model (Architecture §3, FTA §6).
 *
 * Navigation is DATA, not markup. Two levels: domain groups, each holding items.
 * A sixth domain adds an entry here; no component changes.
 *
 * Every item carries a permission string from the central registry — never an
 * inline literal (FTA §6), because a literal cannot be renamed, found, or audited.
 * The sidebar and the route guards read the same registry, which is what makes it
 * impossible for them to drift. That drift — nav items leading to routes the user
 * cannot open — is the exact defect Discovery found in the legacy build.
 */

export type NavItem = {
  label: string;
  to: string;
  /** A value from PERMISSIONS. Never a hand-typed string. */
  permission: string;
  icon?: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * The navigation tree.
 *
 * Entries are contributed as each resource lands (resource recipe) — never ahead
 * of one, which would mean inventing routes and permission strings no backend has
 * agreed to. Reference/Villes is the first.
 *
 * The path and the permission both come from their owners (the resource's public
 * surface, the central registry) rather than being retyped here. That is what
 * makes it structurally impossible for a nav item to point at a route the guard
 * would refuse — the drift Discovery found in the legacy build.
 */
export const NAV_TREE: NavGroup[] = [
  {
    label: "Référentiel",
    items: [
      {
        label: "Villes",
        to: VILLES_PATH,
        permission: PERMISSIONS.ACCESS_DASHBOARD,
        icon: MapPin,
      },
      {
        label: "Secteurs",
        to: SECTEURS_PATH,
        permission: PERMISSIONS.ACCESS_DASHBOARD,
        icon: Map,
      },
      {
        label: "Produits",
        to: PRODUCTS_PATH,
        permission: PERMISSIONS.ACCESS_DASHBOARD,
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Réseau",
    items: [
      {
        label: "Admins",
        to: ADMINS_PATH,
        // The LIST permission, mirroring the route. The granular admin
        // permissions gate actions inside the page, not visibility of the page.
        permission: PERMISSIONS.ACCESS_DASHBOARD,
        icon: ShieldCheck,
      },
      {
        label: "Managers",
        to: MANAGERS_PATH,
        // `view-agents`, mirroring the route and the backend — NOT
        // access-dashboard. The granular agent permissions gate actions inside
        // the page, not visibility of the page.
        permission: PERMISSIONS.VIEW_AGENTS,
        icon: UserCog,
      },
    ],
  },
];

/**
 * Filters the tree to what this session may actually see.
 *
 * A group survives only if at least one of its items survives — an empty group
 * heading is a promise of navigation that isn't there.
 *
 * Pure and synchronous on purpose: it is the whole of the permission-aware
 * navigation logic, and it is testable without React.
 */
export function filterNav(
  groups: readonly NavGroup[],
  permissions: PermissionResolver,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.has(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
