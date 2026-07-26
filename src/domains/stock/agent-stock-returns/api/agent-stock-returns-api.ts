import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  type AgentStockReturn,
  type AgentStockReturnListParams,
  type AgentStockReturnStatus,
} from "../model/agent-stock-return";
import type { CreateAgentStockReturnFormValues } from "../model/create-agent-stock-return";

/**
 * The Agent Stock Returns endpoints and their mapper (FTA §7, D-6) — the
 * first Stock resource.
 *
 * `index()` USES LARAVEL'S STANDARD RESOURCE-COLLECTION ENVELOPE
 * (`{data, links, meta}`) — verified fresh from source
 * (`AgentStockReturnController::index` returns
 * `AgentStockReturnResource::collection($query->paginate(...))` directly,
 * no custom wrapper). The SAME shape `fromLaravelPage`/
 * `LaravelPageEnvelope<T>` already normalize for Villes/Bons/Deposits —
 * reused verbatim, not reinvented (unlike Cheques'/Debt Payments' own
 * bespoke flat-paginator parses, which exist precisely because THEIR
 * envelopes are not this shape).
 *
 * EVERY SINGLE-RESOURCE RESPONSE IS `{"data": {...}}` — confirmed no
 * `JsonResource::withoutWrapping()` call exists anywhere in the backend
 * (exhaustive grep), so `show()`/`store()`/`update()`/`validateReturn()`
 * and all three line mutations (which return the PARENT
 * `AgentStockReturnResource`, not a line resource — verified from
 * `AgentStockReturnLineController`'s own docblock: "No separate
 * AgentStockReturnLineResource is exposed at the HTTP boundary") all wrap
 * identically. One `toAgentStockReturn()` mapper serves all of them.
 *
 * `destroy()` returns `204 No Content` — not called by this phase (delete
 * was deliberately not built; see the domain's own routes.tsx docblock).
 */

type AgentStockReturnLineRow = {
  id: number;
  return_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

type AgentStockReturnRow = {
  id: number;
  return_number: string;
  status: AgentStockReturnStatus;
  montant: string;
  notes: string | null;
  return_date: string | null;
  admin_id: number;
  commercial_id: number;
  manager_id: number;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  creator: { id: number; name: string } | null;
  commercial: { id: number; nom: string; prenom: string } | null;
  manager: { id: number; nom: string; prenom: string } | null;
  approver: { id: number; name: string } | null;
  lines?: AgentStockReturnLineRow[];
  validation_summary?: {
    total_lines: number;
    total_quantity: number;
    total_montant: string;
  };
};

type AgentStockReturnsEnvelope = LaravelPageEnvelope<AgentStockReturnRow>;

/** `show()`/`store()`/`update()`/`validateReturn()`/every line mutation's envelope — Laravel's default single-resource `{"data": {...}}` wrapping. */
type AgentStockReturnEnvelope = {
  data: AgentStockReturnRow;
};

function toAgentStockReturn(row: AgentStockReturnRow): AgentStockReturn {
  return {
    id: row.id,
    returnNumber: row.return_number,
    status: row.status,
    montant: row.montant,
    notes: row.notes,
    returnDate: row.return_date,
    commercialId: row.commercial_id,
    // `commercial`/`manager` are always eager-loaded on every response this
    // domain reads (verified: every controller method loads both) — the
    // null-safe fallback only guards the resource's own defensive null-on
    // relation-resolution-failure case (e.g. a deleted agent row).
    commercialName: row.commercial
      ? `${row.commercial.prenom} ${row.commercial.nom}`
      : "—",
    managerId: row.manager_id,
    managerName: row.manager ? `${row.manager.prenom} ${row.manager.nom}` : "—",
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
          totalLines: row.validation_summary.total_lines,
          totalQuantity: row.validation_summary.total_quantity,
          totalMontant: row.validation_summary.total_montant,
        }
      : undefined,
  };
}

export async function fetchAgentStockReturns(
  params: AgentStockReturnListParams,
): Promise<Paginated<AgentStockReturn>> {
  const { data } = await httpClient.get<AgentStockReturnsEnvelope>(
    "/admin/agent-stock-returns",
    {
      params: {
        page: params.page,
        // Every optional filter is OMITTED rather than sent empty —
        // `IndexAgentStockReturnRequest`'s own rules are all `sometimes`,
        // so an empty value would misrepresent what is being filtered.
        ...(params.status ? { status: params.status } : {}),
        ...(params.commercialId ? { commercial_id: params.commercialId } : {}),
        ...(params.managerId ? { manager_id: params.managerId } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
      },
    },
  );

  return fromLaravelPage(data, toAgentStockReturn);
}

export async function fetchAgentStockReturnById(id: number): Promise<AgentStockReturn> {
  const { data } = await httpClient.get<AgentStockReturnEnvelope>(
    `/admin/agent-stock-returns/${id}`,
  );
  return toAgentStockReturn(data.data);
}

export async function createAgentStockReturn(
  values: CreateAgentStockReturnFormValues,
): Promise<AgentStockReturn> {
  const { data } = await httpClient.post<AgentStockReturnEnvelope>(
    "/admin/agent-stock-returns",
    {
      return_number: values.returnNumber.trim(),
      manager_id: values.managerId,
      commercial_id: values.commercialId,
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      ...(values.returnDate.trim() ? { return_date: values.returnDate.trim() } : {}),
    },
  );
  return toAgentStockReturn(data.data);
}

/**
 * `POST /admin/agent-stock-returns/{id}/validate` — no payload. Irreversible
 * (FTA D-7): materializes stock movements, re-asserts the binding under a
 * row lock, and can 409 with any of the `RETURN_*` codes this phase
 * registers in `error-code-registry.ts`.
 */
export async function validateAgentStockReturn(id: number): Promise<AgentStockReturn> {
  const { data } = await httpClient.post<AgentStockReturnEnvelope>(
    `/admin/agent-stock-returns/${id}/validate`,
  );
  return toAgentStockReturn(data.data);
}

/**
 * The three line mutations — verified fresh from source
 * (`AgentStockReturnLineController`) — ALL return the PARENT
 * `AgentStockReturnResource`, already refreshed with recomputed `montant`.
 * `removeLine` is a 200 with the updated aggregate, NOT a 204 — a genuine
 * divergence from every prior domain's own delete convention in this app
 * (Villes/Secteurs/Products' `deleteX` all return `void` from a 204).
 */
export async function addAgentStockReturnLine(
  returnId: number,
  values: { productId: number; quantity: number; unitCost: string; notes: string },
): Promise<AgentStockReturn> {
  const { data } = await httpClient.post<AgentStockReturnEnvelope>(
    `/admin/agent-stock-returns/${returnId}/lines`,
    {
      product_id: values.productId,
      quantity: values.quantity,
      unit_cost: values.unitCost,
      ...(values.notes ? { notes: values.notes } : {}),
    },
  );
  return toAgentStockReturn(data.data);
}

export async function updateAgentStockReturnLine(
  returnId: number,
  lineId: number,
  values: { quantity: number; unitCost: string; notes: string },
): Promise<AgentStockReturn> {
  const { data } = await httpClient.patch<AgentStockReturnEnvelope>(
    `/admin/agent-stock-returns/${returnId}/lines/${lineId}`,
    {
      quantity: values.quantity,
      unit_cost: values.unitCost,
      notes: values.notes || null,
    },
  );
  return toAgentStockReturn(data.data);
}

export async function removeAgentStockReturnLine(
  returnId: number,
  lineId: number,
): Promise<AgentStockReturn> {
  const { data } = await httpClient.delete<AgentStockReturnEnvelope>(
    `/admin/agent-stock-returns/${returnId}/lines/${lineId}`,
  );
  return toAgentStockReturn(data.data);
}
