import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import {
  useCreateDebtPaymentMutation,
  useDebtPaymentsQuery,
} from "../queries/debt-payments-queries";
import { DEBT_PAYMENTS_PATH } from "../routes";
import { DEBT_PAYMENT_LIST_DEFAULTS } from "../model/debt-payment";
import {
  DEBT_PAYMENT_PROOF_ACCEPT,
  createDebtPaymentSchema,
  defaultCreateDebtPaymentValues,
  type CreateDebtPaymentFormValues,
} from "../model/create-debt-payment";

/**
 * The Record Debt Payment page (roadmap M4) — `POST /admin/debt-payments`.
 *
 * THE CLIENT-SIDE AMOUNT CEILING IS A UX MIRROR ONLY, PER EXPLICIT
 * INSTRUCTION — the backend stays the sole source of truth. `currentDebt`
 * is read from the SAME `useDebtPaymentsQuery` the list page already uses
 * (LIVE tier, likely warm in cache from navigating here from that list) —
 * not a second, dedicated endpoint. If this value is stale by the time the
 * operator submits (another cash-method deposit changed it in the
 * meantime), the client-side warning is simply wrong for a moment; the
 * real `store()` validator re-checks `admin->debt` fresh at submission
 * time regardless, so a stale mirror can only ever produce an honest 422,
 * never a bad write. (Proactively refetching this value immediately before
 * submit — the FTA §8 "freshness rule" — is explicitly a LATER, separate
 * phase; this page does not attempt it.)
 *
 * TWO DIFFERENT BACKEND FAILURE SHAPES, both handled, re-verified from
 * source (see `api/debt-payments-api.ts`'s own docblock for the full
 * reasoning): the ceiling-exceeded rule is an ORDINARY field-mapped 422
 * (`errors.amount`) — same as any other field validation, shown via the
 * standard `fieldError("amount")` path, backend text verbatim (this
 * codebase's own convention for a field 422, not a business-rule 422).
 * `admin->debt <= 0` ("nothing to repay") is a genuine bare `{"error":
 * ...}` response with no field to attach to — rendered as a general,
 * domain-owned banner instead, never the backend's raw text.
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — same established pattern as
 * every other Money create page: on success, navigate to the Debt Payments
 * list, where the newly invalidated query's refetch shows the new row and
 * the updated `current_debt`/`total_paid` summary as the confirmation.
 */
export function CreateDebtPaymentPage() {
  const navigate = useNavigate();

  const debtPaymentsQuery = useDebtPaymentsQuery(DEBT_PAYMENT_LIST_DEFAULTS);
  const currentDebt = debtPaymentsQuery.data?.summary.currentDebt;

  const form = useForm<CreateDebtPaymentFormValues>({
    resolver: zodResolver(createDebtPaymentSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateDebtPaymentValues,
  });

  const amount = form.watch("amount");
  const exceedsCurrentDebt =
    currentDebt !== undefined &&
    amount !== "" &&
    !Number.isNaN(Number(amount)) &&
    Number(amount) > Number(currentDebt);

  const createMutation = useCreateDebtPaymentMutation();

  const onSubmit = form.handleSubmit((values) => {
    if (exceedsCurrentDebt) return;
    createMutation.mutate(values, {
      onSuccess: () => navigate(DEBT_PAYMENTS_PATH),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const amountError = fieldError("amount");
  const receiptNumberError = fieldError("receipt_number");
  const proofImageError = fieldError("proof_image");

  const hasFieldError = !!amountError || !!receiptNumberError || !!proofImageError;

  // `admin->debt <= 0` ("nothing to repay") is the one bare `{"error":...}`
  // failure this endpoint has — no `errors` object, so `kind` normalizes to
  // "unknown" at status 422. See the module docblock and the API layer's
  // own docblock for why this is the only case in this shape.
  const isNoDebtToRepay =
    isAppError(mutationError) &&
    mutationError.status === 422 &&
    mutationError.kind !== "validation";

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to record a debt payment."
        : isNoDebtToRepay
          ? "You have no outstanding debt to repay."
          : "Something went wrong recording this payment. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Record debt payment</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {currentDebt !== undefined
            ? `Your current debt is ${currentDebt} DH.`
            : "Loading your current debt…"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount (MAD)
        </label>
        <Input
          id="amount"
          inputMode="decimal"
          aria-invalid={
            !!form.formState.errors.amount || !!amountError || exceedsCurrentDebt
          }
          {...form.register("amount")}
        />
        {form.formState.errors.amount ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.amount.message}
          </p>
        ) : null}
        {!form.formState.errors.amount && exceedsCurrentDebt ? (
          <p role="alert" className="text-destructive text-xs">
            This exceeds your current debt of {currentDebt} DH.
          </p>
        ) : null}
        {amountError ? (
          <p role="alert" className="text-destructive text-xs">
            {amountError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="receiptNumber" className="text-sm font-medium">
          Receipt number
        </label>
        <Input
          id="receiptNumber"
          aria-invalid={!!form.formState.errors.receiptNumber || !!receiptNumberError}
          {...form.register("receiptNumber")}
        />
        {form.formState.errors.receiptNumber ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.receiptNumber.message}
          </p>
        ) : null}
        {receiptNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {receiptNumberError}
          </p>
        ) : null}
      </div>

      <FileUploadField
        label="Proof"
        required
        accept={DEBT_PAYMENT_PROOF_ACCEPT}
        helperText="JPEG, PNG or PDF, up to 5MB."
        value={form.watch("photo")}
        onChange={(file) => form.setValue("photo", file, { shouldValidate: true })}
        error={form.formState.errors.photo?.message ?? proofImageError}
      />

      {generalError ? (
        <p role="alert" className="text-destructive text-sm">
          {generalError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(DEBT_PAYMENTS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending || exceedsCurrentDebt}>
          {createMutation.isPending ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
