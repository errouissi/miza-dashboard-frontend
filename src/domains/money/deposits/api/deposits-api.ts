import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  type Deposit,
  type DepositListParams,
  type DepositMethod,
  type DepositStatus,
  type DepositType,
} from "../model/deposit";

/**
 * The Deposits endpoints and their mapper (FTA §7, D-6). Phase 1 —
 * READ-ONLY (`fetchDeposits`). Detail/Create/Validate/Reject are later
 * M4.3 phases.
 *
 * `index()` USES LARAVEL'S STANDARD RESOURCE-COLLECTION ENVELOPE
 * (`{data, links, meta}`, plus `status`/`message` merged in via
 * `.additional()`) — verified fresh from source this phase (`DepoController
 * ::index`: `DepoResource::collection($deposits)->additional([...])
 * ->response()`), NOT Cheques' own flat custom paginator. This is the SAME
 * shape `fromLaravelPage`/`LaravelPageEnvelope<T>` already normalize for
 * Villes — reused verbatim here, not reinvented. The extra `status`/
 * `message` siblings `.additional()` adds are simply ignored (the type
 * below does not declare them; `fromLaravelPage` never reads anything
 * beyond `data`/`meta`).
 *
 * ONE SHARED RESOURCE SHAPE ACROSS `index()`/`show()`/`store()` — verified
 * fresh from source (commit `8786326`): all three now return through
 * `DepoResource`. `show()`'s single-resource response is Laravel's default
 * `{"data": {...}}` wrapping (no `JsonResource::withoutWrapping()` call
 * exists anywhere in the backend, confirmed by search); `store()`'s
 * `DepoResource` instance sits as the `data` VALUE inside a plain
 * `['message'=>..., 'data'=>new DepoResource($depo)]` array, which is NOT
 * re-wrapped (that only happens when a Resource is the literal top-level
 * return value). Only `index()` is consumed this phase, but `toDeposit()`
 * is written once against the one shared row shape so Detail/Create can
 * reuse it unchanged when their own phases start.
 */

type DepositRow = {
  id: number;
  amount: number;
  status: DepositStatus;
  type: DepositType;
  method: DepositMethod;
  receipt: string | null;
  proof_url: string | null;
  /**
   * `Y-m-d H:i` (e.g. `"2026-07-25 14:30"`) — verified from
   * `DepoResource::toArray()` (`$this->created_at->format('Y-m-d H:i')`).
   * NOT ISO-8601, unlike Cheques' `created_at`/`processed_at` (Laravel's
   * default Carbon serialization) — the only shape `shared/formatters`'
   * `toDate()` has ever been exercised against. `new Date("2026-07-25
   * 14:30")` happens to parse under V8 today, but that is
   * implementation-defined per the ECMAScript spec for a non-ISO string,
   * not a contract this codebase already relies on — normalized to an
   * unambiguous ISO shape in `toDeposit()` below, at the mapper boundary,
   * rather than depending on that leniency.
   */
  date: string;
  agent: {
    id: number;
    full_name: string;
    account_number: string;
    photo: string | null;
  };
  created_by: string;
  // `reject_reason`/`validated_by`/`validated_at`/`bank_name`/`proof_type`
  // all arrive too (verified from source) — deliberately unmapped until
  // the detail page (a later M4.3 phase) reads them. See `model/deposit.ts`.
};

type DepositsEnvelope = LaravelPageEnvelope<DepositRow>;

/** `Y-m-d H:i` -> an ISO-8601 date-time string `toDate()` is guaranteed to parse. */
function toIsoDateTime(wireDate: string): string {
  return wireDate.replace(" ", "T");
}

function toDeposit(row: DepositRow): Deposit {
  return {
    id: row.id,
    amount: row.amount,
    status: row.status,
    type: row.type,
    method: row.method,
    receipt: row.receipt,
    proofUrl: row.proof_url,
    createdAt: toIsoDateTime(row.date),
    agentId: row.agent.id,
    agentName: row.agent.full_name,
    agentAccountNumber: row.agent.account_number,
    agentPhotoUrl: row.agent.photo,
    createdBy: row.created_by,
  };
}

export async function fetchDeposits(
  params: DepositListParams,
): Promise<Paginated<Deposit>> {
  const { data } = await httpClient.get<DepositsEnvelope>("/admin/depos", {
    params: {
      page: params.page,
      // Every optional filter is OMITTED rather than sent empty — `index()`
      // uses `$request->filled(...)` throughout, so an empty value would
      // just make the URL lie about what is being filtered.
      ...(params.search ? { search: params.search } : {}),
      ...(params.agentId ? { agent_id: params.agentId } : {}),
      // The WIRE name is `deposit_method` (legacy), not `method` — verified
      // from source (`$request->filled('deposit_method')`, filtering the
      // `method` column).
      ...(params.method ? { deposit_method: params.method } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  });

  return fromLaravelPage(data, toDeposit);
}
