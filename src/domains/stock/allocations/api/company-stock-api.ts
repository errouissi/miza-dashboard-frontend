import { httpClient } from "@/infrastructure/http";

/**
 * `GET /admin/companies/{company}/stock` — verified fresh from source
 * (`CompanyController::stock`), added specifically to give Allocation's own
 * "add line" product picker a real source of truth for availability.
 *
 * A FLAT JSON ARRAY, NOT AN ENVELOPE — same shape discipline as
 * `GET /admin/companies`/`GET /admin/suppliers`.
 *
 * ALREADY FILTERED TO `available_quantity > 0` SERVER-SIDE
 * (`CompanyController::stock` filters out zero-quantity rows before
 * responding) — this is now THE backend source of truth for "can this
 * product actually be allocated from this company right now"; the picker
 * built from this response can never offer a product with no stock.
 *
 * KEPT INSIDE THIS DOMAIN (`stock/allocations/`), NOT Companies' own
 * reference module — this read exists because of ALLOCATION'S OWN "add
 * line" picker, the same reasoning `agent-sub-data-api.ts` (Return's/
 * Transfer's own Manager→Commercial cascade read) is domain-local rather
 * than living in Network's Managers/Commercials (ADR-0021's reasoning
 * class). Companies' own reference module (`domains/reference/companies/`)
 * stays a pure `{id, name, code, active}` lookup — no stock concern belongs
 * there.
 */
export type CompanyStockItem = {
  productId: number;
  name: string;
  operator: string;
  /** The product's own face value (e.g. a top-up denomination) — modelled for the same reason `code`/`active` are modelled on Companies' own tiny reference shape (ADR-0008): part of the endpoint's fixed response, not a large row filtered down. */
  value: number;
  availableQuantity: number;
};

type CompanyStockRow = {
  product_id: number;
  name: string;
  operator: string;
  value: number;
  available_quantity: number;
};

export async function fetchCompanyStock(companyId: number): Promise<CompanyStockItem[]> {
  const { data } = await httpClient.get<CompanyStockRow[]>(
    `/admin/companies/${companyId}/stock`,
  );
  return data.map((row) => ({
    productId: row.product_id,
    name: row.name,
    operator: row.operator,
    value: row.value,
    availableQuantity: row.available_quantity,
  }));
}
