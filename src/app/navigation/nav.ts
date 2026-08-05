import type { LucideIcon } from "lucide-react";
import {
  Map,
  MapPin,
  CreditCard,
  ShieldCheck,
  UserCog,
  Users,
  Contact,
  Banknote,
  Clock,
  Landmark,
  Wallet,
  Undo2,
  ArrowLeftRight,
  Building2,
  Truck,
} from "lucide-react";
import { PERMISSIONS, type PermissionResolver } from "@/infrastructure/permissions";
import { ADMINS_PATH } from "@/domains/network/admins";
import { MANAGERS_PATH } from "@/domains/network/managers";
import { COMMERCIALS_PATH } from "@/domains/network/commercials";
import { CLIENTS_PATH } from "@/domains/network/clients";
import { CHEQUES_PATH, CHEQUES_PENDING_PATH } from "@/domains/money/cheques";
import { DEPOSITS_PATH } from "@/domains/money/deposits";
import { DEBT_PAYMENTS_PATH } from "@/domains/money/debt-payments";
import { AGENT_STOCK_RETURNS_PATH } from "@/domains/stock/agent-stock-returns";
import { AGENT_TRANSFERS_PATH } from "@/domains/stock/agent-transfers";
import { ALLOCATIONS_PATH } from "@/domains/stock/allocations";
import { BONS_PATH } from "@/domains/stock/bons";
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
      {
        label: "Commercials",
        to: COMMERCIALS_PATH,
        // `view-agents` — the same string as Managers, since both endpoints
        // sit behind one controller and one permission set.
        permission: PERMISSIONS.VIEW_AGENTS,
        icon: Users,
      },
      {
        label: "Clients",
        to: CLIENTS_PATH,
        // `view-clients` — its OWN permission, not `view-agents`. Clients
        // sits behind a separate ClientController with its own permission set.
        permission: PERMISSIONS.VIEW_CLIENTS,
        icon: Contact,
      },
    ],
  },
  {
    // English, not French like "Référentiel"/"Réseau" above — those predate
    // O-1 (the interface-language decision) being flagged as unsigned;
    // every M3.x-era addition (Admins/Managers/Commercials/Clients item
    // labels) already stayed English, and Money continues that, not the
    // two oldest groups' own convention.
    label: "Money",
    items: [
      {
        label: "Cheques",
        to: CHEQUES_PATH,
        // `view-cheques` — its OWN permission, mirroring the route and the
        // backend. The five other Cheque permissions gate actions inside
        // the page, not visibility of the page.
        permission: PERMISSIONS.VIEW_CHEQUES,
        icon: Banknote,
      },
      {
        label: "Pending Cheques",
        to: CHEQUES_PENDING_PATH,
        // `view-pending-cheques` (M4.2 Phase 3B) — its OWN permission,
        // distinct from `view-cheques` above; a session can hold either
        // without the other, mirroring `GET /admin/cheques/pending`'s own,
        // separate backend check.
        permission: PERMISSIONS.VIEW_PENDING_CHEQUES,
        icon: Clock,
      },
      {
        label: "Deposits",
        to: DEPOSITS_PATH,
        // `view-depos` (M4.3 Phase 1) — its OWN permission, mirroring the
        // route and the backend. The three other Deposit permissions gate
        // actions inside a future detail page, not visibility of this list.
        permission: PERMISSIONS.VIEW_DEPOSITS,
        icon: Landmark,
      },
      {
        label: "Debt Payments",
        to: DEBT_PAYMENTS_PATH,
        // `debt_cash` (roadmap M4) — the SAME single permission gates both
        // this list and its create route; there is no separate
        // view/create split the way Cheques/Deposits each have. No
        // "queue" chip (unlike Cheques/Deposits above) — there is no
        // approval queue here, just list + submit.
        permission: PERMISSIONS.DEBT_PAYMENTS,
        icon: Wallet,
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        label: "Agent Stock Returns",
        to: AGENT_STOCK_RETURNS_PATH,
        // `view-agent-stock-return` (roadmap M5, Phase 1) — its OWN
        // permission, mirroring the route. The other seven Agent Stock
        // Return permissions gate actions (create/update/delete/validate,
        // plus the three line permissions) inside the page, not visibility
        // of the list — same convention every prior domain's own nav entry
        // already follows.
        permission: PERMISSIONS.VIEW_AGENT_STOCK_RETURN,
        icon: Undo2,
      },
      {
        label: "Agent Transfers",
        to: AGENT_TRANSFERS_PATH,
        // `view-agent-transfers` (roadmap M5, Phase 2) — its OWN
        // permission, PLURAL (a genuine divergence from Return's own
        // singular `view-agent-stock-return`, verified from source). The
        // other seven Agent Transfer permissions gate actions inside the
        // page, not visibility of the list — same convention Return's own
        // nav entry already follows.
        permission: PERMISSIONS.VIEW_AGENT_TRANSFERS,
        icon: ArrowLeftRight,
      },
      {
        label: "Allocations",
        to: ALLOCATIONS_PATH,
        // `view-allocations` (roadmap M5, Phase 4) — its OWN permission,
        // PLURAL (matches Transfer's own plurality, not Return's own
        // singular — independently verified, ADR-0022). The other seven
        // Allocation permissions gate actions (create/update/delete/
        // validate, plus the three line permissions) inside the page, not
        // visibility of the list — same convention every prior Stock nav
        // entry already follows.
        permission: PERMISSIONS.VIEW_ALLOCATIONS,
        icon: Building2,
      },
      {
        label: "Bons",
        to: BONS_PATH,
        // `view-bons` (roadmap M5, Phase 5) — its OWN permission, PLURAL
        // (matches Transfer's/Allocation's own plurality, not Return's
        // own singular). The other eight Bon permissions gate actions
        // inside the page, not visibility of the list — same convention
        // every prior Stock nav entry already follows.
        permission: PERMISSIONS.VIEW_BONS,
        icon: Truck,
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
