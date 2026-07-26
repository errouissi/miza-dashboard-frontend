import { useState } from "react";
import { isAppError } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useChequeFreshnessQuery,
  useRejectChequeMutation,
} from "../queries/cheques-queries";
import type { Cheque } from "../model/cheque";

/**
 * Confirmation before rejecting a cheque (M4.2 Phase 3C).
 *
 * `decision_reason` (`required|string|max:1000` server-side,
 * `ChequeController::reject`) is collected via `ConfirmActionDialog`'s new
 * `reason` slot — the confirm button stays disabled until it is non-empty,
 * the same client-side mirror of a `required` rule every form here already
 * applies. A server-side 422 on the same field (e.g. the 1000-char cap)
 * still maps to `reason.error`, not a generic banner.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — `useFreshConfirm` re-verifies
 * this cheque's `status` the instant the dialog opens, via
 * `useChequeFreshnessQuery` (its OWN cache key, deliberately distinct from
 * `useChequeQuery`'s — see that hook's own docblock for why sharing the
 * key would let a transient verification failure corrupt the host page's
 * own display). A failed verification BLOCKS confirm rather than allowing
 * it, per explicit product decision.
 */
type RejectChequeDialogProps = {
  /** Absent = closed. Present = confirm rejecting this cheque. */
  cheque?: Cheque;
  onOpenChange: (open: boolean) => void;
};

export function RejectChequeDialog({ cheque, onOpenChange }: RejectChequeDialogProps) {
  const [reason, setReason] = useState("");
  const rejectMutation = useRejectChequeMutation();

  const freshnessQuery = useChequeFreshnessQuery(cheque?.id ?? -1);
  const freshness = useFreshConfirm({
    open: cheque !== undefined,
    current: cheque,
    query: freshnessQuery,
    hasChanged: (fresh, snapshot) => fresh.status !== snapshot.status,
  });

  const onConfirm = () => {
    if (!cheque || freshness.blocked) return;
    rejectMutation.mutate(
      { id: cheque.id, decisionReason: reason },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const reasonError = isAppError(rejectMutation.error)
    ? rejectMutation.error.fieldErrors?.decision_reason?.[0]
    : undefined;

  const freshnessMessage = freshness.isStale
    ? "This cheque has already been processed."
    : freshness.isUnavailable
      ? "This cheque's current status could not be verified."
      : undefined;

  const errorMessage =
    freshnessMessage ??
    (isAppError(rejectMutation.error) && !reasonError
      ? rejectMutation.error.kind === "permission"
        ? "You do not have permission to reject this cheque."
        : "This cheque could not be rejected. It may already have been processed."
      : undefined);

  return (
    <ConfirmActionDialog
      open={cheque !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          rejectMutation.reset();
          setReason("");
        }
        onOpenChange(open);
      }}
      title="Reject cheque"
      description={
        cheque ? `Reject cheque "${cheque.numCheque}"? This cannot be undone.` : null
      }
      confirmLabel="Reject"
      pendingLabel="Rejecting…"
      onConfirm={onConfirm}
      isPending={rejectMutation.isPending}
      errorMessage={errorMessage}
      confirmDisabled={freshness.blocked}
      reason={{
        label: "Reason",
        value: reason,
        onChange: setReason,
        error: reasonError,
      }}
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
