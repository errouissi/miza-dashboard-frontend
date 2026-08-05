import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import { type Bon, type BonListParams, type BonStatus } from "../model/bon";
import type { CreateBonFormValues } from "../model/create-bon";

/**
 * The Bons endpoints and their mapper (FTA §7, D-6) — the fifth and final
 * Stock resource. Written FRESH against `BonResource::toArray()`/
 * `BonLineResource::toArray()` re-verified this phase — NOT a copy of
 * Allocation's/Transfer's/Return's own mapper with names edited
 * (ADR-0022).
 *
 * `index()` USES LARAVEL'S STANDARD RESOURCE-COLLECTION ENVELOPE
 * (`{data, links, meta}`) — verified fresh from source
 * (`BonController::index` returns `BonResource::collection($query->
 * paginate(...))` directly). The SAME shape `fromLaravelPage` already
 * normalizes for every other Stock resource.
 *
 * A SEPARATE `BonLineResource` EXISTS SERVER-SIDE (unlike Allocation's/
 * Transfer's/Return's own inlined lines) — but its wire fields
 * (`id, bon_id, product_id, quantity, unit_cost, notes, created_at,
 * updated_at, product`) are field-identical to what this mapper already
 * expects; the separate class changes nothing about `toBon()`.
 *
 * EVERY SINGLE-RESOURCE RESPONSE IS `{"data": {...}}` — confirmed no
 * `JsonResource::withoutWrapping()` call exists anywhere in the backend —
 * `show()`/`store()`/`validateBon()`/`cancel()` and both line mutations
 * that DO return a body (add/update — the parent `BonResource`, refreshed)
 * all wrap identically.
 *
 * LINE `destroy()` RETURNS `204 No Content` — a genuine divergence from
 * Allocation's/Transfer's/Return's own line-delete convention (each of
 * those returns `200` + the refreshed parent). Confirmed from source
 * (`BonLineController::destroy` returns a bare `Response`, not a
 * `BonResource`) — `bons.montant` is metadata-only, so there is no
 * recomputed aggregate to return. `removeBonLine` therefore returns
 * `void`; the caller relies on invalidate-and-refetch (FTA D-7), same
 * discipline every other Stock mutation already applies regardless of
 * whether its own response happens to carry a body.
 *
 * `update()`/`destroy()` (PATCH/DELETE `/admin/bons/{id}`) EXIST
 * SERVER-SIDE BUT ARE NOT CALLED HERE — same restraint every prior Stock
 * resource's own mapper already applies; this phase's approved scope is
 * "draft -> add lines -> validate -> cancel", not edit-draft-header.
 */

type BonLineRow = {
  id: number;
  bon_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

type BonRow = {
  id: number;
  bon_number: string;
  status: BonStatus;
  admin_id: number;
  supplier_id: number;
  company_id: number;
  notes: string | null;
  evidence_url: string | null;
  evidence_name: string | null;
  montant: string;
  received_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  supplier: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  creator: { id: number; name: string } | null;
  approver: { id: number; name: string } | null;
  lines?: BonLineRow[];
  /** ONLY `{line_count, total_quantity}` — verified from `ValidationSummary::fromLines()`; no `montant` key, unlike every other Stock resource's own summary. */
  validation_summary?: {
    line_count: number;
    total_quantity: number;
  };
};

type BonsEnvelope = LaravelPageEnvelope<BonRow>;

/** `show()`/`store()`/`validateBon()`/`cancel()`/add-line/update-line's envelope — Laravel's default single-resource `{"data": {...}}` wrapping. */
type BonEnvelope = {
  data: BonRow;
};

function toBon(row: BonRow): Bon {
  return {
    id: row.id,
    bonNumber: row.bon_number,
    status: row.status,
    montant: row.montant,
    notes: row.notes,
    supplierId: row.supplier_id,
    // `supplier`/`company` are always eager-loaded on every response this
    // domain reads (verified: every controller method loads both) — the
    // null-safe fallback only guards the resource's own defensive
    // null-on-relation-resolution-failure case.
    supplierName: row.supplier?.name ?? "—",
    companyId: row.company_id,
    companyName: row.company?.name ?? "—",
    evidenceUrl: row.evidence_url,
    evidenceName: row.evidence_name,
    receivedAt: row.received_at,
    createdByName: row.creator?.name ?? "—",
    approvedByName: row.approver?.name ?? null,
    approvedAt: row.approved_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    lines: row.lines?.map((line) => ({
      id: line.id,
      productId: line.product_id,
      productName: line.product?.name ?? "—",
      quantity: line.quantity,
      unitCost: line.unit_cost,
      notes: line.notes,
    })),
    validationSummary: row.validation_summary
      ? {
          lineCount: row.validation_summary.line_count,
          totalQuantity: row.validation_summary.total_quantity,
        }
      : undefined,
  };
}

export async function fetchBons(params: BonListParams): Promise<Paginated<Bon>> {
  const { data } = await httpClient.get<BonsEnvelope>("/admin/bons", {
    params: {
      page: params.page,
      // Every optional filter is OMITTED rather than sent empty —
      // `IndexBonRequest`'s own rules are all `sometimes`, so an empty
      // value would misrepresent what is being filtered.
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplier_id: params.supplierId } : {}),
      ...(params.companyId ? { company_id: params.companyId } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
      ...(params.direction ? { direction: params.direction } : {}),
    },
  });

  return fromLaravelPage(data, toBon);
}

export async function fetchBonById(id: number): Promise<Bon> {
  const { data } = await httpClient.get<BonEnvelope>(`/admin/bons/${id}`);
  return toBon(data.data);
}

/**
 * The first Stock `FormData` request — `evidence` is required, so this is
 * a `multipart/form-data` body like Cheques' own `createCheque` (axios
 * sets the boundary itself; `httpClient` needs no changes).
 */
function buildCreateBonFormData(values: CreateBonFormValues): FormData {
  const formData = new FormData();
  formData.append("bon_number", values.bonNumber.trim());
  formData.append("supplier_id", values.supplierId);
  formData.append("company_id", values.companyId);
  if (values.notes.trim()) formData.append("notes", values.notes.trim());
  if (values.receivedAt.trim()) formData.append("received_at", values.receivedAt.trim());
  // zod's superRefine already guarantees this is non-null by the time
  // handleSubmit's onSubmit callback runs.
  formData.append("evidence", values.evidence as File);
  return formData;
}

export async function createBon(values: CreateBonFormValues): Promise<Bon> {
  const { data } = await httpClient.post<BonEnvelope>(
    "/admin/bons",
    buildCreateBonFormData(values),
  );
  return toBon(data.data);
}

/**
 * `POST /admin/bons/{id}/validate` — no payload. Irreversible (FTA D-7):
 * materializes stock movements with NO capacity or stock-sufficiency
 * check at all (a bon is the SOURCE of stock) — the only refusals are
 * `BON_NOT_DRAFT`/`BON_HAS_NO_LINES`.
 */
export async function validateBon(id: number): Promise<Bon> {
  const { data } = await httpClient.post<BonEnvelope>(`/admin/bons/${id}/validate`);
  return toBon(data.data);
}

/**
 * `POST /admin/bons/{id}/cancel` — `{cancellation_reason}`, `required|
 * string|min:10|max:2000`. Irreversible, super-admin only (`cancel-bon`).
 * Reverses a VALIDATED bon's stock; can 409 `BON_CANCEL_STOCK_INSUFFICIENT`
 * if that stock was already drawn down elsewhere by the time cancellation
 * is attempted.
 */
export async function cancelBon(id: number, cancellationReason: string): Promise<Bon> {
  const { data } = await httpClient.post<BonEnvelope>(`/admin/bons/${id}/cancel`, {
    cancellation_reason: cancellationReason,
  });
  return toBon(data.data);
}

/**
 * The three line mutations — verified fresh from source
 * (`BonLineController`). Add/update return the PARENT `BonResource`
 * (unchanged in shape — `bons.montant` is metadata-only, no `refresh()`
 * needed, unlike Allocation's own line controller). `removeBonLine`
 * returns `void` — see the module docblock for why (204, no body).
 */
export async function addBonLine(
  bonId: number,
  values: { productId: number; quantity: number; unitCost: string; notes: string },
): Promise<Bon> {
  const { data } = await httpClient.post<BonEnvelope>(`/admin/bons/${bonId}/lines`, {
    product_id: values.productId,
    quantity: values.quantity,
    ...(values.unitCost ? { unit_cost: values.unitCost } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  });
  return toBon(data.data);
}

export async function updateBonLine(
  bonId: number,
  lineId: number,
  values: { quantity: number; unitCost: string; notes: string },
): Promise<Bon> {
  const { data } = await httpClient.patch<BonEnvelope>(
    `/admin/bons/${bonId}/lines/${lineId}`,
    {
      quantity: values.quantity,
      unit_cost: values.unitCost || null,
      notes: values.notes || null,
    },
  );
  return toBon(data.data);
}

export async function removeBonLine(bonId: number, lineId: number): Promise<void> {
  await httpClient.delete(`/admin/bons/${bonId}/lines/${lineId}`);
}
