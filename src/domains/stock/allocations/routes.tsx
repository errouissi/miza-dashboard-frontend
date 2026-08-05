import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AllocationsListPage } from "./pages/allocations-list-page";
import { CreateAllocationPage } from "./pages/create-allocation-page";
import { AllocationDetailPage } from "./pages/allocation-detail-page";

/**
 * Allocations route contributions (FTA §5) — the fourth Stock resource
 * (roadmap M5, Phase 4).
 *
 * THREE FLAT SIBLING ROUTES, not nested `children` — same ADR-0014/FE-2
 * reasoning every Money `*_NEW_PATH` and both prior Stock resources'
 * own routes already established.
 *
 * PERMISSIONS ARE GATED IN FORMREQUESTS, NOT ROUTE MIDDLEWARE — same
 * genuine departure Return's/Transfer's own domains already document
 * (confirmed from source, `routes/api.php`'s own `allocations` group has no
 * `->middleware('permission:...')` calls at all). This route table still
 * gates on the SAME permission strings — `RequirePermission`'s own check is
 * a frontend-only convenience gate; the backend's FormRequest `authorize()`
 * remains the sole real authority regardless of what this table declares.
 *
 * `VIEW_ALLOCATIONS` IS PLURAL — copied verbatim from the backend constant
 * (`AllocationPermissions::VIEW = 'view-allocations'`), matching Transfer's
 * own plurality, not Return's own singular — verified independently, not
 * assumed from either sibling (ADR-0022).
 *
 * NO DELETE ROUTE, NO EDIT ROUTE — `DELETE`/`PATCH /admin/allocations/{id}`
 * both exist server-side, but neither was in this phase's approved scope
 * ("draft -> add lines -> validate"), same restraint Return's/Transfer's
 * own routes already apply. Explicitly deferred, not a contract gap.
 */
export const ALLOCATIONS_PATH = "/stock/allocations";
export const ALLOCATION_NEW_PATH = "/stock/allocations/new";
export const ALLOCATION_DETAIL_PATH = "/stock/allocations/:id";

/** Builds a concrete detail link/navigation target for a given allocation id. */
export function allocationDetailPath(id: number): string {
  return `/stock/allocations/${id}`;
}

export const allocationsRoutes: RouteObject[] = [
  {
    path: ALLOCATIONS_PATH,
    element: <AllocationsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_ALLOCATIONS,
      breadcrumb: "Allocations",
    },
  },
  {
    path: ALLOCATION_NEW_PATH,
    element: <CreateAllocationPage />,
    handle: {
      permission: PERMISSIONS.CREATE_ALLOCATION,
      breadcrumb: "Record allocation",
    },
  },
  {
    path: ALLOCATION_DETAIL_PATH,
    element: <AllocationDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_ALLOCATIONS,
      breadcrumb: "Allocation",
    },
  },
];
