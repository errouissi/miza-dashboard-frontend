import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import { CreateDepositAgentField } from "../components/create-deposit-agent-field";
import {
  useAgentCashQuery,
  useCreateDepositMutation,
  useGrattageOutstandingQuery,
} from "../queries/deposits-queries";
import { DEPOSITS_PATH } from "../routes";
import {
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_PROOF_TYPES,
  DEPOSIT_PROOF_TYPE_LABELS,
  DEPOSIT_TYPES,
  DEPOSIT_TYPE_LABELS,
  type DepositMethod,
  type DepositProofType,
  type DepositType,
} from "../model/deposit";
import {
  DEPOSIT_PROOF_ACCEPT,
  createDepositSchema,
  defaultCreateDepositValues,
  type CreateDepositFormValues,
} from "../model/create-deposit";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Create Deposit page (M4.3 Phase 4) — `POST /admin/depos`. Both
 * Rapped and Grattage flows share this ONE page, per the confirmed
 * decision — the backend already handles both under one endpoint, keyed
 * off `type`, and there is nothing genuinely different in the surrounding
 * fields to justify two separate forms.
 *
 * `amount` IS READ-ONLY AND SYSTEM-POPULATED — the confirmed decision, and
 * the only workable design given the backend's own constraint: `store()`'s
 * rapped branch requires an EXACT match against `agent.cash`
 * (`bccomp($validated['amount'], $agent->cash, 2) !== 0` -> 422), and the
 * grattage branch requires an exact match against the agent's full
 * outstanding grattage total, recomputed under lock inside
 * `DepositService::createGrattageReconciliation`. Neither value is
 * something an operator could type correctly by hand. `useAgentCashQuery`/
 * `useGrattageOutstandingQuery` (this domain's own reads — kept here per
 * the confirmed decision not to introduce a cross-domain import) resolve
 * it; SYNCING THAT ASYNC RESULT INTO RHF's `setValue` IS A GENUINE
 * "synchronize with an external system" case, the appropriate use of
 * `useEffect` this codebase's own working principle draws (as opposed to
 * the render-time-adjustment pattern used elsewhere for a prop-driven
 * local reset).
 *
 * BOTH READS ARE UX HINTS ONLY, NEVER AUTHORITATIVE (see each read's own
 * docblock in `api/deposits-api.ts`) — the backend re-verifies the real
 * match at submission time regardless, so a stale read here can only ever
 * produce an honest 422, never a silently wrong deposit.
 *
 * `bank_name` STAYS ALWAYS VISIBLE, NOT CONDITIONED ON `deposit_method` —
 * the confirmed decision: the backend does not couple the two either, and
 * a UI-only conditional would invent behavior neither Product nor the
 * backend asked for.
 *
 * A BUSINESS-RULE 422 (`{"error": "..."}`, cash mismatch or a grattage
 * reconciliation exception) is a DIFFERENT case from a field-validation 422
 * (`{message, errors}`) — `normalizeError` already discriminates the two
 * (see its own docblock); this page tells them apart via
 * `kind !== "validation"` at `status === 422` and renders its own copy
 * either way, never the backend's raw `error`/`message` text (FTA §17).
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — same established pattern as
 * `CreateChequePage`: on success, navigate to the Deposits list, where the
 * newly invalidated query's refetch surfaces the new row as the
 * confirmation.
 */
export function CreateDepositPage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);

  const form = useForm<CreateDepositFormValues>({
    resolver: zodResolver(createDepositSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateDepositValues,
  });

  const agentId = form.watch("agentId");
  const type = form.watch("type");

  const agentCashQuery = useAgentCashQuery(agentId, {
    enabled: !!agentId && type === "rapped",
  });
  const grattageQuery = useGrattageOutstandingQuery(agentId, {
    enabled: !!agentId && type === "grattage",
  });

  // Reset first: a stale amount from the other branch (or the previous
  // agent) must not stay on screen while the newly relevant read is
  // pending. Declared before the two fill effects below so, within the
  // same commit, this always runs first (React runs a component's effects
  // in declaration order) and the fill effect for the now-active branch
  // gets the final word.
  useEffect(() => {
    form.setValue("amount", "");
  }, [agentId, type, form]);

  useEffect(() => {
    if (type === "rapped" && agentCashQuery.data !== undefined) {
      form.setValue("amount", agentCashQuery.data, { shouldValidate: true });
    }
  }, [type, agentCashQuery.data, form]);

  useEffect(() => {
    if (type === "grattage" && grattageQuery.data !== undefined) {
      form.setValue("amount", grattageQuery.data.requiredTotal, {
        shouldValidate: true,
      });
    }
  }, [type, grattageQuery.data, form]);

  const createMutation = useCreateDepositMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: () => navigate(DEPOSITS_PATH),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const agentIdError = fieldError("agent_id");
  const depositMethodError = fieldError("deposit_method");
  const amountError = fieldError("amount");
  const proofImageError = fieldError("proof_image");
  const receiptNumberError = fieldError("receipt_number");
  const bankNameError = fieldError("bank_name");
  const typeError = fieldError("type");
  const proofTypeError = fieldError("proof_type");

  const hasFieldError =
    !!agentIdError ||
    !!depositMethodError ||
    !!amountError ||
    !!proofImageError ||
    !!receiptNumberError ||
    !!bankNameError ||
    !!typeError ||
    !!proofTypeError;

  // A business-rule 422 (cash mismatch, or a grattage reconciliation
  // exception) arrives with NO `errors` object — `normalizeError` classifies
  // it `kind: "unknown"` at `status: 422` (see its own docblock: the
  // `{"error": "..."}` envelope has no field-mapped shape to discriminate
  // it as `"validation"`). That combination, and only that combination, is
  // this specific case.
  const isAmountMismatch =
    isAppError(mutationError) &&
    mutationError.status === 422 &&
    mutationError.kind !== "validation";

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to create a deposit."
        : isAmountMismatch
          ? "This amount no longer matches what's required for this agent. Refresh and try again."
          : "Something went wrong creating this deposit. Please try again — nothing you entered has been lost."
      : undefined;

  // Distinguishes "not yet resolved" (no agent chosen), "in flight", a real
  // read failure (e.g. a session missing `access-dashboard` for the
  // grattage read — a genuine permission split from `create-depo`, see the
  // page's own docblock) and the resolved value — an `isPending` check
  // alone is not enough, since a disabled query (the inactive branch) also
  // reports `isPending: true` in TanStack Query v5.
  function describeAmountSource(
    query: {
      isPending: boolean;
      isError: boolean;
    },
    loadedText: string,
  ): string {
    if (!agentId) return "Select an agent to resolve this amount.";
    if (query.isError) {
      return "This amount could not be loaded. You may not have permission to view it.";
    }
    if (query.isPending) return "Loading…";
    return loadedText;
  }

  const amountHelperText =
    type === "rapped"
      ? describeAmountSource(
          agentCashQuery,
          "Automatically set to the agent's current cash balance.",
        )
      : describeAmountSource(
          grattageQuery,
          grattageQuery.data
            ? `Automatically set to the agent's total outstanding grattage obligation (${grattageQuery.data.invoiceCount} invoice${grattageQuery.data.invoiceCount === 1 ? "" : "s"}).`
            : "Automatically set to the agent's total outstanding grattage obligation.",
        );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Create deposit</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a deposit as pending. Validation and rejection are handled separately.
        </p>
      </div>

      <CreateDepositAgentField
        value={agentId}
        onChange={(value) => form.setValue("agentId", value, { shouldValidate: true })}
        canReadAgents={canReadAgents}
        error={form.formState.errors.agentId?.message ?? agentIdError}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="depositType" className="text-sm font-medium">
          Type
        </label>
        <select
          id="depositType"
          aria-invalid={!!typeError}
          className={SELECT_CLASS}
          value={type}
          onChange={(event) =>
            form.setValue("type", event.target.value as DepositType, {
              shouldValidate: true,
            })
          }
        >
          {DEPOSIT_TYPES.map((depositType) => (
            <option key={depositType} value={depositType}>
              {DEPOSIT_TYPE_LABELS[depositType]}
            </option>
          ))}
        </select>
        {typeError ? (
          <p role="alert" className="text-destructive text-xs">
            {typeError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount (MAD)
        </label>
        <Input
          id="amount"
          readOnly
          aria-readonly="true"
          aria-invalid={!!form.formState.errors.amount || !!amountError}
          {...form.register("amount")}
        />
        <p className="text-muted-foreground text-xs">{amountHelperText}</p>
        {form.formState.errors.amount ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.amount.message}
          </p>
        ) : null}
        {amountError ? (
          <p role="alert" className="text-destructive text-xs">
            {amountError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="depositMethod" className="text-sm font-medium">
          Deposit method
        </label>
        <select
          id="depositMethod"
          aria-invalid={!!form.formState.errors.depositMethod || !!depositMethodError}
          className={SELECT_CLASS}
          value={form.watch("depositMethod")}
          onChange={(event) =>
            form.setValue("depositMethod", event.target.value as DepositMethod | "", {
              shouldValidate: true,
            })
          }
        >
          <option value="">Select a method</option>
          {DEPOSIT_METHODS.map((method) => (
            <option key={method} value={method}>
              {DEPOSIT_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
        {form.formState.errors.depositMethod ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.depositMethod.message}
          </p>
        ) : null}
        {depositMethodError ? (
          <p role="alert" className="text-destructive text-xs">
            {depositMethodError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="receiptNumber" className="text-sm font-medium">
          Receipt number
        </label>
        <Input
          id="receiptNumber"
          aria-invalid={!!receiptNumberError}
          {...form.register("receiptNumber")}
        />
        {receiptNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {receiptNumberError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bankName" className="text-sm font-medium">
          Bank name
        </label>
        <Input
          id="bankName"
          aria-invalid={!!bankNameError}
          {...form.register("bankName")}
        />
        {bankNameError ? (
          <p role="alert" className="text-destructive text-xs">
            {bankNameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="proofType" className="text-sm font-medium">
          Proof type
        </label>
        <select
          id="proofType"
          aria-invalid={!!proofTypeError}
          className={SELECT_CLASS}
          value={form.watch("proofType")}
          onChange={(event) =>
            form.setValue("proofType", event.target.value as DepositProofType, {
              shouldValidate: true,
            })
          }
        >
          {DEPOSIT_PROOF_TYPES.map((proofType) => (
            <option key={proofType} value={proofType}>
              {DEPOSIT_PROOF_TYPE_LABELS[proofType]}
            </option>
          ))}
        </select>
        {proofTypeError ? (
          <p role="alert" className="text-destructive text-xs">
            {proofTypeError}
          </p>
        ) : null}
      </div>

      <FileUploadField
        label="Proof image"
        required
        accept={DEPOSIT_PROOF_ACCEPT}
        helperText="JPEG or PNG, up to 5MB."
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
          onClick={() => navigate(DEPOSITS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create Deposit"}
        </Button>
      </div>
    </form>
  );
}
