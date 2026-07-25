import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import { CreateChequeAgentField } from "../components/create-cheque-agent-field";
import { useCreateChequeMutation } from "../queries/cheques-queries";
import { CHEQUES_PATH } from "../routes";
import {
  CHEQUE_PHOTO_ACCEPT,
  createChequeSchema,
  defaultCreateChequeValues,
  type CreateChequeFormValues,
} from "../model/create-cheque";

/**
 * The Create Cheque page (roadmap M4.2 Phase 3A) — `POST /admin/cheques`.
 *
 * A PLAIN SINGLE-STEP FORM, not a wizard. Every submit button in the M3.6
 * onboarding wizard is `type="button"`, wired directly to a click handler,
 * because two of ITS buttons once occupied the same JSX tree position across
 * a step transition, causing React to mutate a reused DOM node's `type`
 * attribute mid-click (M3.6 Follow-up 5). This form has exactly one button,
 * always in the same position — the hazard that fix addressed does not
 * exist here, so this page follows the OTHER, much more common convention
 * in this codebase instead: `FormDrawer`'s own shape (`type="submit"` +
 * `disabled={isPending}`, no extra ref guard), used unchanged by every
 * Villes/Secteurs/Products/Admins/Managers/Commercials/Clients create or
 * edit form.
 *
 * MULTIPART, LIKE THE WIZARD: `photo_cheque` is required, so this is the
 * second `FormData` request body in the product (`httpClient`/axios sets
 * the multipart boundary itself — no change needed).
 *
 * NO TOAST LIBRARY EXISTS ANYWHERE IN THIS CODEBASE (verified by search, not
 * assumed from a comment describing one) — two comments in the M3.6 wizard
 * describe a "toast-and-navigate" convention as the product norm, but no
 * actual implementation backs that claim; every real mutation's success
 * path in this app instead relies on the resource's own re-rendered,
 * re-fetched list as its feedback. Adding a toast dependency for this one
 * form would be a new dependency without the justification CLAUDE.md
 * requires. On success this page instead navigates to the Cheques list —
 * the same list Managers'/Commercials' "Create..." buttons navigate AWAY
 * FROM into this kind of page in the first place — where the newly
 * invalidated query refetches and the new cheque appears as the row-level
 * confirmation, exactly like closing a `FormDrawer` after a successful save
 * already does everywhere else. On failure, no navigation: a `role="alert"`
 * banner (mirroring `ManagerFormSheet`'s exact pattern) plus per-field 422
 * mapping, and every value the operator entered — including the chosen
 * file — is left exactly as it was.
 */
export function CreateChequePage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);

  const form = useForm<CreateChequeFormValues>({
    resolver: zodResolver(createChequeSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateChequeValues,
  });

  const createMutation = useCreateChequeMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: () => navigate(CHEQUES_PATH),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const agentIdError = fieldError("agent_id");
  const amountError = fieldError("amount");
  const numChequeError = fieldError("num_cheque");
  const photoError = fieldError("photo_cheque");

  const hasFieldError =
    !!agentIdError || !!amountError || !!numChequeError || !!photoError;

  const generalError =
    isAppError(mutationError) && !hasFieldError && mutationError.kind !== "validation"
      ? mutationError.kind === "permission"
        ? "You do not have permission to create a cheque."
        : "Something went wrong creating this cheque. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Create cheque</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a cheque as pending. Approval, rejection and cancellation are handled
          separately.
        </p>
      </div>

      <Controller
        control={form.control}
        name="agentId"
        render={({ field }) => (
          <CreateChequeAgentField
            value={field.value}
            onChange={field.onChange}
            canReadAgents={canReadAgents}
            error={form.formState.errors.agentId?.message ?? agentIdError}
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">
          Amount (MAD)
        </label>
        <Input
          id="amount"
          inputMode="decimal"
          aria-invalid={!!form.formState.errors.amount || !!amountError}
          {...form.register("amount")}
        />
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
        <label htmlFor="numCheque" className="text-sm font-medium">
          Cheque number
        </label>
        <Input
          id="numCheque"
          aria-invalid={!!form.formState.errors.numCheque || !!numChequeError}
          {...form.register("numCheque")}
        />
        {form.formState.errors.numCheque ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.numCheque.message}
          </p>
        ) : null}
        {numChequeError ? (
          <p role="alert" className="text-destructive text-xs">
            {numChequeError}
          </p>
        ) : null}
      </div>

      <Controller
        control={form.control}
        name="photo"
        render={({ field }) => (
          <FileUploadField
            label="Cheque photo"
            required
            accept={CHEQUE_PHOTO_ACCEPT}
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={form.formState.errors.photo?.message ?? photoError}
          />
        )}
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
          onClick={() => navigate(CHEQUES_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create Cheque"}
        </Button>
      </div>
    </form>
  );
}
