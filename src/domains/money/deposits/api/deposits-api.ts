import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  type Deposit,
  type DepositListParams,
  type DepositMethod,
  type DepositProofType,
  type DepositStatus,
  type DepositType,
} from "../model/deposit";
import type { CreateDepositFormValues } from "../model/create-deposit";

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
  proof_type: DepositProofType;
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

/**
 * Validate/reject (M4.3 Phase 3) both return `void` — the SAME convention
 * `approveCheque`/`rejectCheque` already use. Re-verified fresh from
 * source this phase (`DepoController::validateDepo`/`reject`, unchanged
 * since Phase 1/2's own reads):
 *   - Both are **POST**, not PUT (unlike Cheques' `PUT .../approve` etc.).
 *   - `validate()`'s success body is `{"message": "..."}` — NO `data` key
 *     at all, for either deposit type.
 *   - `reject()`'s success body is the same shape, `{"message": "..."}`.
 * Neither response is parsed into a `Deposit` — the caller invalidates and
 * refetches (FTA D-7, no optimistic mutations for financial workflows),
 * the same discipline `useApproveChequeMutation` already established.
 */

/** `POST /admin/depos/{id}/validate` — no body. `validate-depo` permission. */
export async function validateDeposit(id: number): Promise<void> {
  await httpClient.post(`/admin/depos/${id}/validate`);
}

/**
 * `POST /admin/depos/{id}/reject` — `reject_reason` is
 * `required|string|min:10|max:1000` server-side (verified from source,
 * `DepoController::reject`) — a MINIMUM length, unlike Cheques'
 * `decision_reason` (`required|string|max:1000`, no minimum). `reject-depo`
 * permission.
 */
export async function rejectDeposit(id: number, rejectReason: string): Promise<void> {
  await httpClient.post(`/admin/depos/${id}/reject`, { reject_reason: rejectReason });
}

/**
 * Create (M4.3 Phase 4) — `POST /admin/depos`. FIELDS RE-VERIFIED FRESH FROM
 * `DepoController::store`'s OWN VALIDATOR this phase (see
 * `model/create-deposit.ts`'s own docblock for the exact rule list).
 *
 * `store()`'s success envelope is FLAT — `{"message": "Deposit created",
 * "data": new DepoResource($depo)}` — the SAME shape as `show()`'s `data`,
 * unlike Cheques' own `store()` (which nests `{cheque, photo_url}`). No
 * merge step is needed here the way `createCheque` needs one; `toDeposit()`
 * is called directly against `data.data`.
 *
 * `amount` IS SENT VERBATIM, EXACTLY AS THE PAGE RESOLVED IT — the caller
 * (`CreateDepositPage`) is what guarantees this already matches the agent's
 * `cash` (rapped) or outstanding grattage total (grattage); this function
 * does not re-derive or re-validate that match.
 *
 * TWO DISTINCT FAILURE ENVELOPES exist past the point validation succeeds
 * (verified from source): the rapped cash-mismatch check and both grattage
 * reconciliation exceptions all return `{"error": "..."}` at 422 — NOT
 * Laravel's standard `{message, errors}` shape. `normalizeError` already
 * has a documented fallback for exactly this (`DepoController`/
 * `DebtPaymentController` never emit `message` on failure, only `error`),
 * so this stays a plain re-throw — no special handling needed here. The
 * PAGE is what turns a `kind !== "validation"` 422 into its own copy,
 * never this response's raw `error` text (FTA §17).
 */
function buildCreateDepositFormData(values: CreateDepositFormValues): FormData {
  const formData = new FormData();
  formData.append("agent_id", values.agentId);
  formData.append("deposit_method", values.depositMethod);
  formData.append("amount", values.amount.trim());
  formData.append("type", values.type);
  formData.append("proof_type", values.proofType);
  // zod's superRefine already guarantees this is non-null by the time
  // handleSubmit's onSubmit callback runs.
  formData.append("proof_image", values.photo as File);
  if (values.receiptNumber.trim()) {
    formData.append("receipt_number", values.receiptNumber.trim());
  }
  if (values.bankName.trim()) {
    formData.append("bank_name", values.bankName.trim());
  }
  return formData;
}

/** `store()`'s envelope — flat, matching `show()`'s `data` shape verbatim. */
type CreateDepositEnvelope = {
  message: string;
  data: DepositRow;
};

export async function createDeposit(values: CreateDepositFormValues): Promise<Deposit> {
  const { data } = await httpClient.post<CreateDepositEnvelope>(
    "/admin/depos",
    buildCreateDepositFormData(values),
  );
  return toDeposit(data.data);
}

/**
 * `GET /admin/agents/{id}` (`view-agents`) — re-verified fresh from source
 * this phase (`AgentController::show`): `$agent->toArray()`, `$hidden` is
 * only `['password']`, so `cash` (a `decimal:2`-cast STRING, same
 * convention as `Cheque.amount`) genuinely serializes. Envelope is
 * `{success, role, agent: {...}}` — NOT the `{data: {...}}` wrapping
 * `DepoResource` uses; this is a raw `toArray()` dump, a different
 * controller entirely.
 *
 * A UX HINT ONLY, never authoritative — `DepoController::store`'s own
 * rapped-branch cash-match check (`bccomp($validated['amount'],
 * $agent->cash, 2)`) is what actually enforces the match, reading the
 * agent's cash fresh at submission time. This read can go stale between
 * the operator opening the form and submitting it; that is fine, because
 * nothing here is trusted as a guarantee.
 */
type AgentCashEnvelope = {
  success: boolean;
  agent: { cash: string };
};

export async function fetchAgentCash(agentId: string): Promise<string> {
  const { data } = await httpClient.get<AgentCashEnvelope>(`/admin/agents/${agentId}`);
  return data.agent.cash;
}

/**
 * `GET /admin/agents/{id}/grattage-outstanding` (`access-dashboard`) —
 * re-verified fresh from source this phase (`AgentController
 * ::grattageOutstanding`, Phase 5.10 Commit 5): `summary.required_total` is
 * a `bcadd`-accumulated STRING (e.g. `"0.00"`), never a float.
 *
 * SAME "UX HINT ONLY" CAVEAT AS `fetchAgentCash` — the backend's own
 * `DepositService::createGrattageReconciliation` recomputes the real
 * outstanding total UNDER LOCK at submission time (Phase 5.10 Commit 6);
 * this unlocked read can be stale between load and submit, and the
 * `DepositReconciliationAmountMismatch`/`NoOutstandingObligation`
 * exceptions exist precisely to catch that gap server-side.
 */
type GrattageOutstandingEnvelope = {
  success: boolean;
  data: {
    summary: {
      required_total: string;
      invoice_count: number;
    };
  };
};

export async function fetchGrattageOutstanding(
  agentId: string,
): Promise<{ requiredTotal: string; invoiceCount: number }> {
  const { data } = await httpClient.get<GrattageOutstandingEnvelope>(
    `/admin/agents/${agentId}/grattage-outstanding`,
  );
  return {
    requiredTotal: data.data.summary.required_total,
    invoiceCount: data.data.summary.invoice_count,
  };
}
