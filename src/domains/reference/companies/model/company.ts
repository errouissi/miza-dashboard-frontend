/**
 * A company — seeded reference data for the Stock domain (roadmap M5,
 * Phase 4, Allocations), NOT a dashboard-managed entity.
 *
 * VERIFIED FRESH FROM SOURCE (`App\Models\Company`, `CompanyController`):
 * `companies` is seeded once (`Phase4ASeeder`) and expected to stay stable —
 * there is no `store`/`update`/`destroy` HTTP surface at all, deliberately
 * (confirmed from `routes/api.php`: only `GET /admin/companies` exists).
 * This module therefore has NO create/edit/delete affordance, unlike
 * Villes/Secteurs/Products (which ARE dashboard-managed reference data) —
 * a genuine, narrower shape than that sibling group, not an oversight.
 *
 * `code` IS MODELLED EVEN THOUGH NO CURRENT SCREEN RENDERS IT — unlike
 * ADR-0008's usual "map only consumed fields" discipline, `code` is part of
 * the endpoint's own fixed, tiny response shape (`{id, name, code, active}`,
 * pinned by the backend's own `CompanyIndexTest`), not a large row with
 * many unused columns to filter down. Carrying it costs nothing and avoids
 * re-deriving the type the day a picker wants to disambiguate two
 * same-named companies by code.
 *
 * ALREADY FILTERED TO `active: true` SERVER-SIDE
 * (`CompanyController::index`) — every row this type describes is active by
 * construction; `active` is still modelled (not dropped) because it is part
 * of the fixed response shape, not because the frontend re-filters on it.
 */
export type Company = {
  id: number;
  name: string;
  code: string;
  active: boolean;
};
