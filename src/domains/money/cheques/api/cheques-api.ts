import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import {
  type Cheque,
  type ChequeAllocation,
  type ChequeAllocationType,
  type ChequeListParams,
  type ChequeStatus,
} from "../model/cheque";

/**
 * The Cheques endpoints and their mappers (FTA §7, D-6).
 *
 * PHASE 1 — READ ONLY. `fetchCheques`/`fetchChequeById` only; no
 * store/approve/reject/annuler yet — that is M4.2's own later phase.
 *
 * `index()` USES THE SAME `{success, data: <paginator>}` FLAT-PAGINATOR
 * ENVELOPE Managers/Commercials/Clients already return — verified from
 * source (`ChequeController::index`: `paginate()->through()`, then the
 * whole paginator wrapped under `data`), not assumed by resemblance.
 * `show()`'s envelope is `{success, data: {...}}`, no paginator.
 *
 * `agent` ARRIVES AS THE FULL, UNRESTRICTED NESTED AGENT MODEL
 * (`Cheque::query()->with(['agent', ...])`, no column restriction, unlike
 * Deposits' own `DepoResource`, which narrows it server-side) — reduced
 * here to a display name only, the same reduction Commercials/Clients
 * already apply to their own nested manager/agent relation.
 */

type ChequeAllocationRow = {
  id: number;
  type: ChequeAllocationType;
  amount: string;
};

type ChequeRow = {
  id: number;
  amount: string;
  num_cheque: string;
  agent_id: number;
  decision_reason: string | null;
  processed_at: string | null;
  created_at: string;
  /** Legacy French value, via the model's `statute` accessor — see `model/cheque.ts`. */
  statute: ChequeStatus;
  photo_url: string | null;
  agent: {
    id: number;
    nom: string;
    prenom: string;
    // The agent relation carries every other Agent field too (it is not
    // column-restricted server-side) — deliberately unmapped (ADR-0008):
    // nothing here reads more than the display name.
  };
  // `photo_cheque` (the raw storage path) and `status_label` (buggy/French
  // — see `model/cheque.ts`) both arrive too; neither is mapped.
  /** Only present when `show()` eager-loaded it; absent on list rows. */
  allocations?: ChequeAllocationRow[];
};

type ChequesEnvelope = {
  success: boolean;
  data: {
    data: ChequeRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

type ChequeEnvelope = {
  success: boolean;
  data: ChequeRow;
};

function toChequeAllocation(row: ChequeAllocationRow): ChequeAllocation {
  return { id: row.id, type: row.type, amount: row.amount };
}

function toCheque(row: ChequeRow): Cheque {
  return {
    id: row.id,
    amount: row.amount,
    numCheque: row.num_cheque,
    status: row.statute,
    agentId: row.agent_id,
    agentName: `${row.agent.prenom} ${row.agent.nom}`,
    photoUrl: row.photo_url,
    decisionReason: row.decision_reason,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    allocations: row.allocations?.map(toChequeAllocation),
  };
}

export async function fetchCheques(params: ChequeListParams): Promise<Paginated<Cheque>> {
  const { data } = await httpClient.get<ChequesEnvelope>("/admin/cheques", {
    params: {
      page: params.page,
      per_page: params.perPage,
      // Every optional filter is OMITTED rather than sent empty — the
      // backend treats a missing `statute` the same as `statute=all`
      // (`$request->filled()`-equivalent check), so an empty value would
      // just make the URL lie about what is being filtered.
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { statute: params.status } : {}),
      ...(params.agentId ? { agent_id: params.agentId } : {}),
      ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
      ...(params.dateTo ? { date_to: params.dateTo } : {}),
    },
  });

  const page = data.data;
  return {
    items: page.data.map(toCheque),
    page: page.current_page,
    perPage: page.per_page,
    total: page.total,
    lastPage: page.last_page,
  };
}

export async function fetchChequeById(id: number): Promise<Cheque> {
  const { data } = await httpClient.get<ChequeEnvelope>(`/admin/cheques/${id}`);
  return toCheque(data.data);
}
