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
 * return value). `toDeposit()` is written once against the one shared row
 * shape — Phase 2 (`fetchDepositById`) is the second real caller, proving
 * that design; Create's own phase can reuse it unchanged again.
 *
 * PHASE 2 — `show()`'s five detail-only fields (`reject_reason`/
 * `validated_by`/`validated_at`/`bank_name`/`proof_type`) are now mapped
 * too. They were always present on `index()`'s rows as well (one shared
 * resource, confirmed above) — Phase 1 just had no reader for them yet;
 * extending `DepositRow`/`toDeposit()` in place means the list's own rows
 * carry this richer data for free now, at zero extra cost.
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
  reject_reason: string | null;
  /** A display-name STRING (or `null`), NOT an id/object — `$this->validatedByAdmin->name ?? null`. */
  validated_by: string | null;
  /** Same non-ISO `Y-m-d H:i` shape as `date`. Populates for validated OR rejected — see `model/deposit.ts`. */
  validated_at: string | null;
  bank_name: string | null;
  proof_type: string;
};

type DepositsEnvelope = LaravelPageEnvelope<DepositRow>;

/** `show()`'s envelope — Laravel's default single-resource `{"data": {...}}` wrapping. */
type DepositEnvelope = {
  data: DepositRow;
};

/**
 * `Y-m-d H:i` -> an ISO-8601 date-time string `toDate()` is guaranteed to
 * parse. Guards `null` AND `undefined` (not just the typed `null`) —
 * external wire data is not guaranteed to match its static type at
 * runtime, and a `.replace` on `undefined` would throw inside the query
 * function itself rather than degrading to the absent-dash the rest of
 * this app already renders for a missing date.
 */
function toIsoDateTime(wireDate: string): string;
function toIsoDateTime(wireDate: string | null | undefined): string | null;
function toIsoDateTime(wireDate: string | null | undefined): string | null {
  return wireDate === null || wireDate === undefined ? null : wireDate.replace(" ", "T");
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
    rejectReason: row.reject_reason,
    validatedByName: row.validated_by,
    validatedAt: toIsoDateTime(row.validated_at),
    bankName: row.bank_name,
    proofType: row.proof_type,
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

/**
 * `GET /admin/depos/{id}` (M4.3 Phase 2) — `view-depos`, the SAME
 * permission as the list. Unwraps Laravel's default single-resource
 * `{"data": {...}}` wrapping (verified from source: `show()` returns `new
 * DepoResource(...)` directly as the controller's top-level return value,
 * and no `JsonResource::withoutWrapping()` call exists anywhere in the
 * backend).
 *
 * `show()` itself has NO try/catch — a missing id fails at Laravel's own
 * route-model-binding step, before the method body runs, producing the
 * framework's generic `{"message": "No query results for model [...] N"}`
 * 404 (not a hand-built `{success:false,...}` envelope the way Cheques'
 * `show()` returns). Still normalizes to `kind:"notfound"` via
 * `normalizeError`'s bare-status path — no special handling needed here,
 * but the raw message is internal/generic, which is why the detail page
 * renders its own copy rather than this response's `message`.
 */
export async function fetchDepositById(id: number): Promise<Deposit> {
  const { data } = await httpClient.get<DepositEnvelope>(`/admin/depos/${id}`);
  return toDeposit(data.data);
}
