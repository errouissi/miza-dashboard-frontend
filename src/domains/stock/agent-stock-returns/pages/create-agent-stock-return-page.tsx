import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ReturnManagerCommercialField } from "../components/return-manager-commercial-field";
import { useCreateAgentStockReturnMutation } from "../queries/agent-stock-returns-queries";
import { agentStockReturnDetailPath, AGENT_STOCK_RETURNS_PATH } from "../routes";
import {
  createAgentStockReturnSchema,
  defaultCreateAgentStockReturnValues,
  type CreateAgentStockReturnFormValues,
} from "../model/create-agent-stock-return";

/**
 * The Record Agent Stock Return page (roadmap M5, Phase 1) —
 * `POST /admin/agent-stock-returns`. HEADER FIELDS ONLY — see
 * `model/create-agent-stock-return.ts`'s own docblock for why lines are
 * added afterward, on the detail page, not part of this submission.
 *
 * SELECTING A DIFFERENT MANAGER CLEARS THE COMMERCIAL — the reset lives
 * HERE, in this page's own manager-change handler, not inside
 * `ReturnManagerCommercialField` itself (see that component's own
 * docblock for why: a child reaching up to clear a sibling field during
 * its own render is the pattern being avoided).
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — same established pattern as
 * every other create page in this product: on success, navigate straight
 * to the new return's OWN DETAIL PAGE (not the list) — this is where the
 * operator adds lines next, the actual next step in the roadmap's own
 * "draft -> add lines -> validate" sequence, not a detour through the list.
 */
export function CreateAgentStockReturnPage() {
  const navigate = useNavigate();

  const form = useForm<CreateAgentStockReturnFormValues>({
    resolver: zodResolver(createAgentStockReturnSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateAgentStockReturnValues,
  });

  const createMutation = useCreateAgentStockReturnMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => navigate(agentStockReturnDetailPath(created.id)),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const returnNumberError = fieldError("return_number");
  const managerError = fieldError("manager_id");
  const commercialError = fieldError("commercial_id");
  const notesError = fieldError("notes");
  const returnDateError = fieldError("return_date");

  const hasFieldError =
    !!returnNumberError ||
    !!managerError ||
    !!commercialError ||
    !!notesError ||
    !!returnDateError;

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to record a stock return."
        : "Something went wrong recording this stock return. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Record stock return</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a draft. Add lines and validate on the next page.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="returnNumber" className="text-sm font-medium">
          Return number
        </label>
        <Input
          id="returnNumber"
          aria-invalid={!!form.formState.errors.returnNumber || !!returnNumberError}
          {...form.register("returnNumber")}
        />
        {form.formState.errors.returnNumber ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.returnNumber.message}
          </p>
        ) : null}
        {returnNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {returnNumberError}
          </p>
        ) : null}
      </div>

      <ReturnManagerCommercialField
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
        <label htmlFor="returnDate" className="text-sm font-medium">
          Return date
        </label>
        <Input
          id="returnDate"
          type="date"
          aria-invalid={!!returnDateError}
          {...form.register("returnDate")}
        />
        {returnDateError ? (
          <p role="alert" className="text-destructive text-xs">
            {returnDateError}
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
          onClick={() => navigate(AGENT_STOCK_RETURNS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Recording…" : "Record Return"}
        </Button>
      </div>
    </form>
  );
}
