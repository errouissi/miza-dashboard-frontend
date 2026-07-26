import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { TransferManagerCommercialField } from "../components/transfer-manager-commercial-field";
import { useCreateAgentTransferMutation } from "../queries/agent-transfers-queries";
import { agentTransferDetailPath, AGENT_TRANSFERS_PATH } from "../routes";
import {
  createAgentTransferSchema,
  defaultCreateAgentTransferValues,
  type CreateAgentTransferFormValues,
} from "../model/create-agent-transfer";

/**
 * The Record Agent Transfer page (roadmap M5, Phase 2) —
 * `POST /admin/agent-transfers`. HEADER FIELDS ONLY — see
 * `model/create-agent-transfer.ts`'s own docblock for why lines are added
 * afterward, on the detail page, not part of this submission.
 *
 * SELECTING A DIFFERENT MANAGER CLEARS THE COMMERCIAL — the reset lives
 * HERE, in this page's own manager-change handler, not inside
 * `TransferManagerCommercialField` itself, same reasoning Return's own
 * create page already established.
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — on success, navigate straight
 * to the new transfer's OWN DETAIL PAGE (not the list) — this is where the
 * operator adds lines next, the actual next step in the roadmap's own
 * "draft -> add lines -> validate" sequence.
 */
export function CreateAgentTransferPage() {
  const navigate = useNavigate();

  const form = useForm<CreateAgentTransferFormValues>({
    resolver: zodResolver(createAgentTransferSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateAgentTransferValues,
  });

  const createMutation = useCreateAgentTransferMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => navigate(agentTransferDetailPath(created.id)),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const transferNumberError = fieldError("transfer_number");
  const managerError = fieldError("manager_id");
  const commercialError = fieldError("commercial_id");
  const notesError = fieldError("notes");
  const transferDateError = fieldError("transfer_date");

  const hasFieldError =
    !!transferNumberError ||
    !!managerError ||
    !!commercialError ||
    !!notesError ||
    !!transferDateError;

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to record a transfer."
        : "Something went wrong recording this transfer. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Record transfer</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a draft. Add lines and validate on the next page.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="transferNumber" className="text-sm font-medium">
          Transfer number
        </label>
        <Input
          id="transferNumber"
          aria-invalid={!!form.formState.errors.transferNumber || !!transferNumberError}
          {...form.register("transferNumber")}
        />
        {form.formState.errors.transferNumber ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.transferNumber.message}
          </p>
        ) : null}
        {transferNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {transferNumberError}
          </p>
        ) : null}
      </div>

      <TransferManagerCommercialField
        managerId={form.watch("managerId")}
        commercialId={form.watch("commercialId")}
        onManagerChange={(managerId) => {
          form.setValue("managerId", managerId, { shouldValidate: true });
          // Clears the (almost certainly no-longer-valid) commercial
          // selection in the SAME event that changed the manager — see
          // the module docblock.
          form.setValue("commercialId", "", { shouldValidate: true });
        }}
        onCommercialChange={(commercialId) =>
          form.setValue("commercialId", commercialId, { shouldValidate: true })
        }
        managerError={form.formState.errors.managerId?.message ?? managerError}
        commercialError={form.formState.errors.commercialId?.message ?? commercialError}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="transferDate" className="text-sm font-medium">
          Transfer date
        </label>
        <Input
          id="transferDate"
          type="date"
          aria-invalid={!!transferDateError}
          {...form.register("transferDate")}
        />
        {transferDateError ? (
          <p role="alert" className="text-destructive text-xs">
            {transferDateError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <Input
          id="notes"
          aria-invalid={!!form.formState.errors.notes || !!notesError}
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.notes.message}
          </p>
        ) : null}
        {notesError ? (
          <p role="alert" className="text-destructive text-xs">
            {notesError}
          </p>
        ) : null}
      </div>

      {generalError ? (
        <p role="alert" className="text-destructive text-sm">
          {generalError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(AGENT_TRANSFERS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Recording…" : "Record Transfer"}
        </Button>
      </div>
    </form>
  );
}
