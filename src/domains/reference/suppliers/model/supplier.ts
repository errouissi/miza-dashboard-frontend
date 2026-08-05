/**
 * A supplier — seeded reference data for the Stock domain (roadmap M5,
 * Phase 5, Supplier Bons), NOT a dashboard-managed entity.
 *
 * VERIFIED FRESH FROM SOURCE (`App\Models\Supplier`, `SupplierController`):
 * `suppliers` is seeded once (`Phase4ASeeder`) and expected to stay
 * stable — there is no `store`/`update`/`destroy` HTTP surface at all
 * (confirmed from `routes/api.php`: only `GET /admin/suppliers` exists),
 * the identical gap Allocations found and closed for Companies (M5 Phase
 * 4). This module is deliberately the same narrow shape as
 * `domains/reference/companies/` — no create/edit/delete affordance.
 *
 * `code` IS MODELLED for the same reason as Company's own: part of the
 * endpoint's fixed, tiny response shape (`{id, name, code, active}`,
 * pinned by the backend's own `SupplierIndexTest`), not a large row with
 * unused columns to filter down.
 *
 * ALREADY FILTERED TO `active: true` SERVER-SIDE
 * (`SupplierController::index`) — every row this type describes is
 * active by construction.
 */
export type Supplier = {
  id: number;
  name: string;
  code: string;
  active: boolean;
};
