import { httpClient } from "@/infrastructure/http";
import type { Supplier } from "../model/supplier";

/**
 * `GET /admin/suppliers` — verified fresh from source
 * (`App\Http\Controllers\Api\V1\SupplierController::index`), added this
 * phase specifically to unblock the Bon create form's supplier picker —
 * mirrors `GET /admin/companies` byte-for-byte.
 *
 * A FLAT JSON ARRAY, NOT AN ENVELOPE — no `{data: [...]}` wrapper, no
 * `links`/`meta` (confirmed by the backend's own
 * `test_response_is_a_flat_array_not_a_paginated_envelope`).
 *
 * NO PAGINATION, NO SEARCH, NO SORT — the endpoint accepts no query
 * parameters at all (mirrors `SecteurController::index()`'s own shape,
 * same as Companies). Building any of those controls would invent a
 * capability the API does not have (ADR-0009).
 */
export async function fetchSupplierOptions(): Promise<Supplier[]> {
  const { data } = await httpClient.get<Supplier[]>("/admin/suppliers");
  return data;
}
