import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type {
  DebtPayment,
  DebtPaymentListParams,
  DebtPaymentsSummary,
} from "../model/debt-payment";
import type { CreateDebtPaymentFormValues } from "../model/create-debt-payment";

/**
 * The Debt Payments endpoints and their mapper (FTA §7, D-6) — the third and
 * final Money resource.
 *
 * `index()` RETURNS A THIRD, DISTINCT PAGINATION ENVELOPE — verified fresh
 * from source (`DebtPaymentController::index`), reducible to neither
 * `fromLaravelPage`/`LaravelPageEnvelope<T>` (Villes/Bons/Deposits' own
 * `{data, meta}` resource-collection shape) NOR Cheques' own `{success,
 * data: <paginator>}` flat wrapper: this endpoint returns `{current_debt,
 * total_paid, payments: <raw Eloquent paginator>}` — the paginator sits
 * under `payments`, not `data`, and two sibling scalars (`current_debt`,
 * `total_paid`) ride alongside it. No prior Money list needed anything
 * beyond its own rows; this is the first one bundling summary context, so
 * it gets its own small, hand-written parse rather than being bent to fit
 * either existing helper.
 *
 * `payments` ITSELF is Laravel's default `LengthAwarePaginator::toArray()`
 * shape (`current_page`, `data`, `last_page`, `per_page`, `total`, plus
 * `links`/`*_page_url` fields this app has never read and does not read
 * here either) — the SAME flat paginator shape Cheques' own `data` field
 * carries, just nested one level deeper under a different key.
 *
 * NO ROW MAPPING BEYOND THE FIELDS THIS SCREEN RENDERS — `DebtPayment` has
 * no dedicated API Resource (verified: `index()`/`store()` both return raw
 * `toArray()`/`load()` output), so the row also carries `admin_id`
 * (always the caller's own id — never rendered, there is nothing to
 * distinguish), `updated_at` and (on `store()`'s response only) a nested
 * `admin` relation — none of which this domain maps, per ADR-0008.
 */

type DebtPaymentRow = {
  id: number;
  amount: string;
  receipt_number: string | null;
  proof_image_url: string | null;
  /** Plain ISO-8601 — see `model/debt-payment.ts`'s own docblock. */
  created_at: string;
};

type DebtPaymentsPaginator = {
  data: DebtPaymentRow[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

type DebtPaymentsIndexEnvelope = {
  current_debt: string | number;
  total_paid: string | number;
  payments: DebtPaymentsPaginator;
};

/** `store()`'s own flat envelope — `{message, data: <row>, new_debt}`. */
type CreateDebtPaymentEnvelope = {
  message: string;
  data: DebtPaymentRow;
  new_debt: string | number;
};

function toDebtPayment(row: DebtPaymentRow): DebtPayment {
  return {
    id: row.id,
    amount: row.amount,
    receipt: row.receipt_number,
    proofUrl: row.proof_image_url,
    createdAt: row.created_at,
  };
}

export async function fetchDebtPayments(
  params: DebtPaymentListParams,
): Promise<{ summary: DebtPaymentsSummary; page: Paginated<DebtPayment> }> {
  const { data } = await httpClient.get<DebtPaymentsIndexEnvelope>(
    "/admin/debt-payments",
    { params: { page: params.page } },
  );

  return {
    // Coerced defensively — see `model/debt-payment.ts`'s own docblock on
    // why `total_paid`'s wire type (a raw SQL `SUM`, not a cast attribute)
    // could not be confirmed as a JSON string vs. number from source alone.
    summary: {
      currentDebt: String(data.current_debt),
      totalPaid: String(data.total_paid),
    },
    page: {
      items: data.payments.data.map(toDebtPayment),
      page: data.payments.current_page,
      perPage: data.payments.per_page,
      total: data.payments.total,
      lastPage: data.payments.last_page,
    },
  };
}

/**
 * `POST /admin/debt-payments` — multipart (`proof_image` is required). The
 * CEILING CHECK (`amount` must not exceed `current_debt`) IS ENFORCED BY
 * THE BACKEND ONLY here — this function sends whatever `amount` the form
 * collected and lets the real validator decide; see
 * `model/create-debt-payment.ts`'s own docblock for why the client-side
 * mirror stays out of the schema.
 *
 * TWO DIFFERENT FAILURE SHAPES exist past this point, re-verified carefully
 * from source (not assumed from Deposits' own precedent, which turned out
 * NOT to match):
 *   - The ceiling-exceeded rule is a CLOSURE INSIDE `$request->validate()`
 *     itself (`function ($attribute, $value, $fail) use ($admin) { ...
 *     $fail('Le montant ne peut pas dépasser...') }`), with no surrounding
 *     try/catch — so it throws Laravel's ORDINARY `ValidationException` and
 *     arrives as a standard field-mapped 422 (`errors: {amount: [...]}`),
 *     `kind: "validation"`. This is NOT a bare `{"error": ...}` response —
 *     an earlier draft of this docblock assumed it was, by analogy to
 *     Deposits' own cash-mismatch check, before re-reading this exact
 *     method found the two are structurally different (Deposits' check
 *     runs AFTER its own `$request->validate()` call; this one runs
 *     INSIDE it). The caller maps it via the ordinary `fieldErrors.amount`
 *     path, same as any other field validation message — this codebase's
 *     own established convention for a field-level 422 (see Cheques'
 *     "duplicate cheque number" precedent) is to show the backend's field
 *     message verbatim, not invent replacement copy.
 *   - `admin->debt <= 0` ("nothing to repay") IS a genuine bare `{"error":
 *     "..."}` response — a plain `if` statement AFTER `$request->validate()`
 *     already succeeded, matching `normalizeError`'s documented fallback
 *     for this controller. This one has no field to attach to (it is not
 *     about the amount entered, it is about there being no debt at all),
 *     so the caller renders its own general, domain-owned copy for it,
 *     never this response's raw French text (FTA §17).
 */
export async function submitDebtPayment(
  values: CreateDebtPaymentFormValues,
): Promise<DebtPayment> {
  const formData = new FormData();
  formData.append("amount", values.amount.trim());
  formData.append("receipt_number", values.receiptNumber.trim());
  // zod's superRefine already guarantees this is non-null by the time
  // handleSubmit's onSubmit callback runs.
  formData.append("proof_image", values.photo as File);

  const { data } = await httpClient.post<CreateDebtPaymentEnvelope>(
    "/admin/debt-payments",
    formData,
  );
  return toDebtPayment(data.data);
}
