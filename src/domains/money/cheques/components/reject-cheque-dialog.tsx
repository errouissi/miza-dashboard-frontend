import { useState } from "react";
import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useRejectChequeMutation } from "../queries/cheques-queries";
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
 */
type RejectChequeDialogProps = {
  /** Absent = closed. Present = confirm rejecting this cheque. */
  cheque?: Cheque;
  onOpenChange: (open: boolean) => void;
};

export function RejectChequeDialog({ cheque, onOpenChange }: RejectChequeDialogProps) {
  const [reason, setReason] = useState("");
  const rejectMutation = useRejectChequeMutation();

  const onConfirm = () => {
    if (!cheque) return;
    rejectMutation.mutate(
      { id: cheque.id, decisionReason: reason },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const reasonError = isAppError(rejectMutation.error)
    ? rejectMutation.error.fieldErrors?.decision_reason?.[0]
    : undefined;

  const errorMessage =
    isAppError(rejectMutation.error) && !reasonError
      ? rejectMutation.error.kind === "permission"
        ? "You do not have permission to reject this cheque."
        : "This cheque could not be rejected. It may already have been processed."
      : undefined;

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
      reason={{
        label: "Reason",
        value: reason,
        onChange: setReason,
        error: reasonError,
      }}
    />
  );
}
