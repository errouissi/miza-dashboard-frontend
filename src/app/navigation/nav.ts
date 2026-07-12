import type { LucideIcon } from "lucide-react";
import type { PermissionResolver } from "@/infrastructure/permissions";

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
 * EMPTY IN M1-B, and correctly so: no domain exists yet, and the permission
 * registry is empty too. Entries are contributed as each resource lands
 * (resource recipe). Inventing nav items now would mean inventing routes and
 * permission strings that no backend has agreed to.
 *
 * The consequence is deliberate and worth stating: the sidebar renders no groups
 * at runtime in M1-B. `filterNav` is verified against fixtures instead.
 */
export const NAV_TREE: NavGroup[] = [];

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
