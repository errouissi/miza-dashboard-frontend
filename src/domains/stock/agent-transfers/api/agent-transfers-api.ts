import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  type AgentTransfer,
  type AgentTransferListParams,
  type AgentTransferStatus,
} from "../model/agent-transfer";
import type { CreateAgentTransferFormValues } from "../model/create-agent-transfer";

/**
 * The Agent Transfers endpoints and their mapper (FTA §7, D-6) — the second
 * Stock resource. Written FRESH against `AgentTransferResource::toArray()`
 * re-verified this phase — NOT a copy of Agent Stock Return's own mapper
 * with names edited (per this phase's explicit decision #5).
 *
 * `index()` USES LARAVEL'S STANDARD RESOURCE-COLLECTION ENVELOPE
 * (`{data, links, meta}`) — verified fresh from source
 * (`AgentTransferController::index` returns
 * `AgentTransferResource::collection($query->paginate(...))` directly, no
 * custom wrapper). The SAME shape `fromLaravelPage`/`LaravelPageEnvelope<T>`
 * already normalize for Return/Villes/Bons/Deposits.
 *
 * EVERY SINGLE-RESOURCE RESPONSE IS `{"data": {...}}` — confirmed no
 * `JsonResource::withoutWrapping()` call exists anywhere in the backend, so
 * `show()`/`store()`/`update()`/`validateTransfer()` and all three line
 * mutations (which return the PARENT `AgentTransferResource`, not a line
 * resource — verified from `AgentTransferLineController`'s own docblock)
 * all wrap identically. One `toAgentTransfer()` mapper serves all of them.
 *
 * `destroy()` returns `204 No Content` — not called by this phase (delete
 * was deliberately not built; mirrors Return's own restraint).
 */

type AgentTransferLineRow = {
  id: number;
  transfer_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

type AgentTransferRow = {
  id: number;
  transfer_number: string;
  status: AgentTransferStatus;
  montant: string;
  notes: string | null;
  transfer_date: string | null;
  admin_id: number;
  manager_id: number;
  commercial_id: number;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  creator: { id: number; name: string } | null;
  manager: { id: number; nom: string; prenom: string } | null;
  commercial: { id: number; nom: string; prenom: string } | null;
  approver: { id: number; name: string } | null;
  lines?: AgentTransferLineRow[];
  /**
   * `{line_count, total_quantity, montant}` — verified directly from
   * `AgentTransferResource::toArray()`'s own `validation_summary` closure.
   * GENUINELY DIFFERENT KEY NAMES from Return's own
   * `{total_lines, total_quantity, total_montant}` — not a typo to
   * normalize away.
   */
  validation_summary?: {
    line_count: number;
    total_quantity: number;
    montant: string;
  };
};

type AgentTransfersEnvelope = LaravelPageEnvelope<AgentTransferRow>;

/** `show()`/`store()`/`update()`/`validateTransfer()`/every line mutation's envelope — Laravel's default single-resource `{"data": {...}}` wrapping. */
type AgentTransferEnvelope = {
  data: AgentTransferRow;
};

function toAgentTransfer(row: AgentTransferRow): AgentTransfer {
  return {
    id: row.id,
    transferNumber: row.transfer_number,
    status: row.status,
    montant: row.montant,
    notes: row.notes,
    transferDate: row.transfer_date,
    managerId: row.manager_id,
    // `manager`/`commercial` are always eager-loaded on every response this
    // domain reads (verified: every controller method loads both) — the
    // null-safe fallback only guards the resource's own defensive null-on
    // relation-resolution-failure case (e.g. a deleted agent row).
    managerName: row.manager ? `${row.manager.prenom} ${row.manager.nom}` : "—",
    commercialId: row.commercial_id,
    commercialName: row.commercial
      ? `${row.commercial.prenom} ${row.commercial.nom}`
      : "—",
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

export async function fetchAgentTransfers(
  params: AgentTransferListParams,
): Promise<Paginated<AgentTransfer>> {
  const { data } = await httpClient.get<AgentTransfersEnvelope>(
    "/admin/agent-transfers",
    {
      params: {
        page: params.page,
        // Every optional filter is OMITTED rather than sent empty —
        // `IndexAgentTransferRequest`'s own rules are all `sometimes`, so an
        // empty value would misrepresent what is being filtered.
        ...(params.status ? { status: params.status } : {}),
        ...(params.managerId ? { manager_id: params.managerId } : {}),
        ...(params.commercialId ? { commercial_id: params.commercialId } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
      },
    },
  );

  return fromLaravelPage(data, toAgentTransfer);
}

export async function fetchAgentTransferById(id: number): Promise<AgentTransfer> {
  const { data } = await httpClient.get<AgentTransferEnvelope>(
    `/admin/agent-transfers/${id}`,
  );
  return toAgentTransfer(data.data);
}

export async function createAgentTransfer(
  values: CreateAgentTransferFormValues,
): Promise<AgentTransfer> {
  const { data } = await httpClient.post<AgentTransferEnvelope>(
    "/admin/agent-transfers",
    {
      transfer_number: values.transferNumber.trim(),
      manager_id: values.managerId,
      commercial_id: values.commercialId,
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      ...(values.transferDate.trim()
        ? { transfer_date: values.transferDate.trim() }
        : {}),
    },
  );
  return toAgentTransfer(data.data);
}

/**
 * `POST /admin/agent-transfers/{id}/validate` — no payload. Irreversible
 * (FTA D-7): materializes stock movements, re-asserts the binding under a
 * row lock, checks the commercial's remaining grattage capacity and
 * outstanding-obligation restock gate, and can 409 with any of the
 * `TRANSFER_*`/`AGENT_TRANSFER_*` codes this phase registers in
 * `error-code-registry.ts`.
 */
export async function validateAgentTransfer(id: number): Promise<AgentTransfer> {
  const { data } = await httpClient.post<AgentTransferEnvelope>(
    `/admin/agent-transfers/${id}/validate`,
  );
  return toAgentTransfer(data.data);
}

/**
 * The three line mutations — verified fresh from source
 * (`AgentTransferLineController`) — ALL return the PARENT
 * `AgentTransferResource`, already refreshed with recomputed `montant`.
 * `removeLine` is a 200 with the updated aggregate, NOT a 204 — same
 * divergence from every prior domain's own delete convention Return's own
 * mapper already documents.
 */
export async function addAgentTransferLine(
  transferId: number,
  values: { productId: number; quantity: number; unitCost: string; notes: string },
): Promise<AgentTransfer> {
  const { data } = await httpClient.post<AgentTransferEnvelope>(
    `/admin/agent-transfers/${transferId}/lines`,
    {
      product_id: values.productId,
      quantity: values.quantity,
      unit_cost: values.unitCost,
      ...(values.notes ? { notes: values.notes } : {}),
    },
  );
  return toAgentTransfer(data.data);
}

export async function updateAgentTransferLine(
  transferId: number,
  lineId: number,
  values: { quantity: number; unitCost: string; notes: string },
): Promise<AgentTransfer> {
  const { data } = await httpClient.patch<AgentTransferEnvelope>(
    `/admin/agent-transfers/${transferId}/lines/${lineId}`,
    {
      quantity: values.quantity,
      unit_cost: values.unitCost,
      notes: values.notes || null,
    },
  );
  return toAgentTransfer(data.data);
}

export async function removeAgentTransferLine(
  transferId: number,
  lineId: number,
): Promise<AgentTransfer> {
  const { data } = await httpClient.delete<AgentTransferEnvelope>(
    `/admin/agent-transfers/${transferId}/lines/${lineId}`,
  );
  return toAgentTransfer(data.data);
}
