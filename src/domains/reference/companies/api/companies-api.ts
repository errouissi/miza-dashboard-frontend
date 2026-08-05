import { httpClient } from "@/infrastructure/http";
import type { Company } from "../model/company";

/**
 * `GET /admin/companies` — verified fresh from source
 * (`App\Http\Controllers\Api\V1\CompanyController::index`).
 *
 * A FLAT JSON ARRAY, NOT AN ENVELOPE — no `{data: [...]}` wrapper, no
 * `links`/`meta` (confirmed by the backend's own
 * `test_response_is_a_flat_array_not_a_paginated_envelope`). `fromLaravelPage`
 * does not apply here; there is no page to normalize.
 *
 * NO PAGINATION, NO SEARCH, NO SORT — the endpoint accepts no query
 * parameters at all (mirrors `SecteurController::index()`'s own shape).
 * Building any of those controls would invent a capability the API does not
 * have (ADR-0009).
 */
export async function fetchCompanyOptions(): Promise<Company[]> {
  const { data } = await httpClient.get<Company[]>("/admin/companies");
  return data;
}
