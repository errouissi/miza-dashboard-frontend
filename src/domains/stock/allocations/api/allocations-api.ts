import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  type Allocation,
  type AllocationListParams,
  type AllocationStatus,
} from "../model/allocation";
import type { CreateAllocationFormValues } from "../model/create-allocation";

/**
 * The Allocations endpoints and their mapper (FTA §7, D-6) — the fourth
 * Stock resource. Written FRESH against `AllocationResource::toArray()`
 * re-verified this phase — NOT a copy of Return's/Transfer's own mapper
 * with names edited (per ADR-0022).
 *
 * `index()` USES LARAVEL'S STANDARD RESOURCE-COLLECTION ENVELOPE
 * (`{data, links, meta}`) — verified fresh from source
 * (`AllocationController::index` returns
 * `AllocationResource::collection($query->paginate(...))` directly, no
 * custom wrapper). The SAME shape `fromLaravelPage`/`LaravelPageEnvelope<T>`
 * already normalize for Return/Transfer/Villes/Bons/Deposits.
 *
 * EVERY SINGLE-RESOURCE RESPONSE IS `{"data": {...}}` — confirmed no
 * `JsonResource::withoutWrapping()` call exists anywhere in the backend, so
 * `show()`/`store()`/`validateAllocation()` and all three line mutations
 * (which return the PARENT `AllocationResource`, not a line resource —
 * verified from `AllocationLineController`'s own docblock) all wrap
 * identically. One `toAllocation()` mapper serves all of them.
 *
 * `destroy()`/`update()` (PATCH/DELETE `/admin/allocations/{id}`) EXIST
 * SERVER-SIDE BUT ARE NOT CALLED HERE — same restraint Return's/Transfer's
 * own mapper already applies: neither built UI for its own equivalent, and
 * this phase's approved scope is "draft -> add lines -> validate" only.
 */

type AllocationLineRow = {
  id: number;
  allocation_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

type AllocationRow = {
  id: number;
  allocation_number: string;
  status: AllocationStatus;
  montant: string;
  notes: string | null;
  company_id: number;
  agent_id: number;
  admin_id: number;
  approved_by: number | null;
  approved_at: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  company: { id: number; name: string } | null;
  agent: { id: number; nom: string; prenom: string } | null;
  creator: { id: number; name: string } | null;
  approver: { id: number; name: string } | null;
  lines?: AllocationLineRow[];
  /**
   * `{line_count, total_quantity, montant}` — verified directly from
   * `AllocationResource::toArray()`'s own `validation_summary` closure.
   */
  validation_summary?: {
    line_count: number;
    total_quantity: number;
    montant: string;
  };
};

type AllocationsEnvelope = LaravelPageEnvelope<AllocationRow>;

/** `show()`/`store()`/`validateAllocation()`/every line mutation's envelope — Laravel's default single-resource `{"data": {...}}` wrapping. */
type AllocationEnvelope = {
  data: AllocationRow;
};

function toAllocation(row: AllocationRow): Allocation {
  return {
    id: row.id,
    allocationNumber: row.allocation_number,
    status: row.status,
    montant: row.montant,
    notes: row.notes,
    companyId: row.company_id,
    // `company`/`agent` are always eager-loaded on every response this
    // domain reads (verified: every controller method loads both) — the
    // null-safe fallback only guards the resource's own defensive null-on
    // relation-resolution-failure case (e.g. a deleted row).
    companyName: row.company?.name ?? "—",
    agentId: row.agent_id,
    agentName: row.agent ? `${row.agent.prenom} ${row.agent.nom}` : "—",
    createdByName: row.creator?.name ?? "—",
    approvedByName: row.approver?.name ?? null,
    approvedAt: row.approved_at,
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
          montant: row.validation_summary.montant,
        }
      : undefined,
  };
}

export async function fetchAllocations(
  params: AllocationListParams,
): Promise<Paginated<Allocation>> {
  const { data } = await httpClient.get<AllocationsEnvelope>("/admin/allocations", {
    params: {
      page: params.page,
      // Every optional filter is OMITTED rather than sent empty —
      // `IndexAllocationRequest`'s own rules are all `sometimes`, so an
      // empty value would misrepresent what is being filtered.
      ...(params.status ? { status: params.status } : {}),
      ...(params.agentId ? { agent_id: params.agentId } : {}),
      ...(params.companyId ? { company_id: params.companyId } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
      ...(params.direction ? { direction: params.direction } : {}),
    },
  });

  return fromLaravelPage(data, toAllocation);
}

export async function fetchAllocationById(id: number): Promise<Allocation> {
  const { data } = await httpClient.get<AllocationEnvelope>(`/admin/allocations/${id}`);
  return toAllocation(data.data);
}

export async function createAllocation(
  values: CreateAllocationFormValues,
): Promise<Allocation> {
  const { data } = await httpClient.post<AllocationEnvelope>("/admin/allocations", {
    allocation_number: values.allocationNumber.trim(),
    company_id: values.companyId,
    agent_id: values.agentId,
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  });
  return toAllocation(data.data);
}

/**
 * `POST /admin/allocations/{id}/validate` — no payload. Irreversible
 * (FTA D-7): materializes stock movements, draws FIFO against the
 * manager's validated grattage deposits, and can 409 with any of the
 * `ALLOCATION_*` codes this phase registers in `error-code-registry.ts`.
 */
export async function validateAllocation(id: number): Promise<Allocation> {
  const { data } = await httpClient.post<AllocationEnvelope>(
    `/admin/allocations/${id}/validate`,
  );
  return toAllocation(data.data);
}

/**
 * The three line mutations — verified fresh from source
 * (`AllocationLineController`) — ALL return the PARENT `AllocationResource`,
 * already `refresh()`-ed with recomputed `montant` (the controller's own
 * docblock explains why: `AllocationService` recomputes `montant` on a
 * fresh locked instance inside the transaction, so the route-bound model
 * has stale `montant` without an explicit `refresh()` first — a deliberate
 * divergence from `BonLineController`, whose `montant` is metadata-only and
 * needs no refresh). `removeLine` is a 200 with the updated aggregate, NOT
 * a 204 — same divergence from every prior domain's own delete convention
 * Return's/Transfer's own mapper already documents.
 */
export async function addAllocationLine(
  allocationId: number,
  values: { productId: number; quantity: number; unitCost: string; notes: string },
): Promise<Allocation> {
  const { data } = await httpClient.post<AllocationEnvelope>(
    `/admin/allocations/${allocationId}/lines`,
    {
      product_id: values.productId,
      quantity: values.quantity,
      unit_cost: values.unitCost,
      ...(values.notes ? { notes: values.notes } : {}),
    },
  );
  return toAllocation(data.data);
}

export async function updateAllocationLine(
  allocationId: number,
  lineId: number,
  values: { quantity: number; unitCost: string; notes: string },
): Promise<Allocation> {
  const { data } = await httpClient.patch<AllocationEnvelope>(
    `/admin/allocations/${allocationId}/lines/${lineId}`,
    {
      quantity: values.quantity,
      unit_cost: values.unitCost,
      notes: values.notes || null,
    },
  );
  return toAllocation(data.data);
}

export async function removeAllocationLine(
  allocationId: number,
  lineId: number,
): Promise<Allocation> {
  const { data } = await httpClient.delete<AllocationEnvelope>(
    `/admin/allocations/${allocationId}/lines/${lineId}`,
  );
  return toAllocation(data.data);
}
