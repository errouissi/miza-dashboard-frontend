import { isAppError } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useCancelGrattageInvoiceMutation,
  useGrattageInvoiceFreshnessQuery,
} from "../queries/grattage-invoices-queries";
import {
  isGrattageInvoiceCancellable,
  type GrattageInvoice,
} from "../model/grattage-invoice";

/**
 * Confirmation before cancelling a Grattage Invoice (roadmap M6, Phase 1).
 *
 * A PLAIN CONFIRM, NO REASON FIELD — unlike Bons' own cancel.
 * `GrattageInvoiceController::cancel` reads no request body at all
 * (verified from source); there is no `cancellation_reason`-shaped field
 * on this backend to mirror.
 *
 * `variant="destructive"` — cancelling reverses already-materialized
 * stock (restores the commercial's inventory via
 * `StockService::cancelSale`) and is an undo-shaped, irreversible action,
 * the same posture `CancelBonDialog` already established for its own
 * cancel.
 *
 * FRESHNESS RULE (FTA §8, ADR-0018) — `useFreshConfirm` re-verifies this
 * invoice's cancellability the instant the dialog opens, via
 * `useGrattageInvoiceFreshnessQuery` (its OWN cache key, distinct from
 * `useGrattageInvoiceQuery`'s). `hasChanged` reuses
 * `isGrattageInvoiceCancellable` — the SAME predicate the detail page's
 * own button gating uses — so this dialog and its own launch condition
 * can never silently disagree about what counts as cancellable.
 *
 * THE `deposit_id !== null` FREEZE IS PART OF THAT SAME PREDICATE, not a
 * separate check — a reconciliation deposit can link this invoice
 * (`deposit_id` set) between page load and confirm, which freezes
 * cancellation even though `status` alone would still read
 * `pending`/`overdue`. `useFreshConfirm`'s `hasChanged` catches exactly
 * this case: it fires whenever the fresh read is no longer cancellable by
 * ANY part of the predicate, not only a status transition.
 */
type CancelGrattageInvoiceDialogProps = {
  /** Absent = closed. Present = confirm cancelling this invoice. */
  invoice?: GrattageInvoice;
  onOpenChange: (open: boolean) => void;
};

export function CancelGrattageInvoiceDialog({
  invoice,
  onOpenChange,
}: CancelGrattageInvoiceDialogProps) {
  const cancelMutation = useCancelGrattageInvoiceMutation();

  const freshnessQuery = useGrattageInvoiceFreshnessQuery(invoice?.id ?? -1);
  const freshness = useFreshConfirm({
    open: invoice !== undefined,
    current: invoice,
    query: freshnessQuery,
    hasChanged: (fresh) => !isGrattageInvoiceCancellable(fresh),
  });

  const onConfirm = () => {
    if (!invoice || freshness.blocked) return;
    cancelMutation.mutate(invoice.id, { onSuccess: () => onOpenChange(false) });
  };

  const freshnessMessage = freshness.isStale
    ? "This invoice can no longer be cancelled — it may already have been processed or linked to a reconciliation deposit."
    : freshness.isUnavailable
      ? "This invoice's current status could not be verified."
      : undefined;

  const mutationMessage = isAppError(cancelMutation.error)
    ? cancelMutation.error.kind === "permission"
      ? "You do not have permission to cancel this invoice."
      : "This invoice could not be cancelled. It may already have been processed."
    : undefined;

  const errorMessage = freshnessMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={invoice !== undefined}
      onOpenChange={(open) => {
        if (!open) cancelMutation.reset();
        onOpenChange(open);
      }}
      title="Cancel grattage invoice"
      description={
        invoice
          ? `Cancel invoice #${invoice.id}? This restores the commercial's stock and cannot be undone.`
          : null
      }
      confirmLabel="Cancel invoice"
      pendingLabel="Cancelling…"
      cancelLabel="Back"
      onConfirm={onConfirm}
      isPending={cancelMutation.isPending}
      errorMessage={errorMessage}
      variant="destructive"
      confirmDisabled={freshness.blocked}
    >
      {freshness.isChecking ? (
        <p className="text-muted-foreground text-sm">Checking for changes…</p>
      ) : null}
      {freshness.isUnavailable ? (
        <Button type="button" variant="outline" size="sm" onClick={freshness.retry}>
          Retry
        </Button>
      ) : null}
    </ConfirmActionDialog>
  );
}
