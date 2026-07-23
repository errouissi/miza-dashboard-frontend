import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useAssignClientsBulkMutation } from "../queries/clients-queries";

/**
 * The M3.5 bulk-assign sheet — a DEDICATED component, not a repurposed
 * `ConfirmActionDialog`. That component is destructive-action-shaped
 * (hardcoded `variant="destructive"` confirm button, no input slot) and
 * bulk-assign is neither destructive nor confirm-only: it needs a real input
 * (which commercial), so it is built on `FormDrawer` instead — the same shell
 * `ClientFormSheet` uses, reused unchanged, not modified.
 *
 * ONE FIELD: the target commercial. Sourced from Commercials' own public
 * surface (`useCommercialOptionsQuery`, exported for exactly this caller),
 * filtered to ACTIVE commercials only — mirroring the real backend
 * constraint (`assignBulk` rejects anything else), so this picker never
 * offers a selection that would 422.
 *
 * GATED ON `view-agents` VIA `enabled`, a DIFFERENT permission from
 * `assign-client` (which gates the sheet's own reachability at the list
 * page). Mirrors `ClientFormSheet`'s `useVilleOptionsQuery({ enabled })`
 * gate on `access-dashboard` — the same reasoning: this drawer's `children`
 * render whenever the list page does (`FormDrawer` owns only the shell), so
 * the underlying picker query must not fire for a session that cannot
 * resolve it.
 *
 * COPY STATES PLAINLY that only the assigned commercial changes — city and
 * sector are left exactly as they are (see `clients-api.ts`'s
 * `assignClientsBulk` docblock for the verified-from-source reason).
 *
 * ERROR HANDLING, per the M3.5 discovery pass: `assignBulk` is the first
 * Clients endpoint that correctly returns a field-mapped 422 for a malformed
 * shape (mapped onto `agent_id` below). The business-rule rejection ("agent_id
 * must reference an active commercial", "some clients do not exist") carries
 * no `errors` object and no `code`, so it normalizes to `kind: "unknown"` —
 * deliberately folded into the SAME generic-failure branch `ClientFormSheet`
 * already uses for its own non-validation errors, not matched by the
 * backend's message string and not worked around.
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const bulkAssignSchema = z.object({
  agentId: z.string().trim().min(1, "Select a commercial."),
});

type FormValues = z.infer<typeof bulkAssignSchema>;

type ClientBulkAssignSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current-page selection, captured at the moment the sheet was opened. */
  clientIds: number[];
  /** Called once the assignment succeeds — the caller clears its selection here. */
  onAssigned: () => void;
};

export function ClientBulkAssignSheet({
  open,
  onOpenChange,
  clientIds,
  onAssigned,
}: ClientBulkAssignSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(bulkAssignSchema),
    defaultValues: { agentId: "" },
  });

  const assignMutation = useAssignClientsBulkMutation();

  const { has } = usePermission();
  const canViewAgents = has(PERMISSIONS.VIEW_AGENTS);
  const commercialsQuery = useCommercialOptionsQuery({ enabled: canViewAgents });
  const commercials = commercialsQuery.data ?? [];

  // Re-seed on open, so opening the sheet straight after a previous
  // assignment does not show the last pick or a stale error.
  useEffect(() => {
    if (open) {
      form.reset({ agentId: "" });
      assignMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit((values) => {
    assignMutation.mutate(
      { agentId: Number(values.agentId), clientIds },
      {
        onSuccess: () => {
          onAssigned();
          onOpenChange(false);
        },
      },
    );
  });

  // Field-level 422s map to their own field — only `agent_id` has a control
  // to attach to; `client_ids` is operator-invisible (the selection, not a
  // typed field), so any error on it falls through to the generic banner.
  const error = assignMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const agentIdError = fieldError("agent_id");
  const hasFieldError = !!agentIdError;

  // The code-less business-rule 422 (kind "unknown") lands here, alongside
  // any other unclassified failure — deliberately not distinguished by
  // message string. See the module docblock.
  const generalError =
    isAppError(error) && !hasFieldError
      ? error.kind === "permission"
        ? "You do not have permission to assign clients."
        : "This assignment could not be completed. Please try again."
      : undefined;

  const count = clientIds.length;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Assign clients"
      description={
        <>
          Assign {count} {count === 1 ? "client" : "clients"} to a commercial. Only the
          assigned commercial changes — each client&rsquo;s city and sector are left
          exactly as they are.
        </>
      }
      onSubmit={onSubmit}
      isPending={assignMutation.isPending}
      errorMessage={generalError}
      submitLabel="Assign"
      pendingLabel="Assigning…"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bulkAssignAgent" className="text-sm font-medium">
          Commercial
        </label>
        <select
          id="bulkAssignAgent"
          aria-invalid={!!form.formState.errors.agentId || !!agentIdError}
          className={SELECT_CLASS}
          {...form.register("agentId")}
        >
          <option value="">Select a commercial</option>
          {commercials.map((commercial) => (
            <option key={commercial.id} value={String(commercial.id)}>
              {commercial.prenom} {commercial.nom}
            </option>
          ))}
        </select>
        {form.formState.errors.agentId ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.agentId.message}
          </p>
        ) : null}
        {agentIdError ? <p className="text-destructive text-xs">{agentIdError}</p> : null}
      </div>
    </FormDrawer>
  );
}
