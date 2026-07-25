import { useState } from "react";
import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useAnnulerChequeMutation } from "../queries/cheques-queries";
import type { Cheque } from "../model/cheque";

/**
 * Confirmation before annuler-ing (cancelling) an approved cheque (M4.2
 * Phase 3C).
 *
 * APPROVED-ONLY, SERVER-SIDE (`ChequeController::annuler`) — the caller
 * (`ChequeDetailPage`) only offers this dialog for a cheque whose status is
 * `accepter`, the same "don't offer a guaranteed no-op" precedent
 * `ManagerStatusDialog` already established.
 *
 * `decision_reason` collected the same way as `RejectChequeDialog` — see
 * its own docblock. The backend ALSO has a negative-balance guard here
 * (refuses if the agent already spent below the reversal amount); that
 * response has an `errors` key too, but keyed by a BALANCE COLUMN
 * (`montant_avance_rapped`, etc.), not `decision_reason` — there is no
 * field in this dialog to map it to, so it falls through to the generic
 * banner via `error.message`, which the backend supplies for exactly this
 * case ("le solde de l'agent ne couvre pas...").
 *
 * `cancelLabel="Keep approved"` — the dialog's own dismiss button
 * overrides the default "Cancel" label specifically because this action's
 * OWN confirm button is ALSO named around the word "cancel" ("Cancel
 * cheque"); two buttons both saying "Cancel" would be ambiguous about
 * which one cancels the CHEQUE and which one cancels the DIALOG.
 */
type AnnulerChequeDialogProps = {
  /** Absent = closed. Present = confirm cancelling this cheque. */
  cheque?: Cheque;
  onOpenChange: (open: boolean) => void;
};

export function AnnulerChequeDialog({ cheque, onOpenChange }: AnnulerChequeDialogProps) {
  const [reason, setReason] = useState("");
  const annulerMutation = useAnnulerChequeMutation();

  const onConfirm = () => {
    if (!cheque) return;
    annulerMutation.mutate(
      { id: cheque.id, decisionReason: reason },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const reasonError = isAppError(annulerMutation.error)
    ? annulerMutation.error.fieldErrors?.decision_reason?.[0]
    : undefined;

  /**
   * The negative-balance guard's own `errors` key is present (making this a
   * `"validation"`-kind AppError) but keyed by a BALANCE COLUMN, not
   * `decision_reason` — detected by absence from the one field this dialog
   * actually renders, not by re-deriving the exact column names, so a
   * future column added to that guard still gets recognised without a code
   * change here.
   */
  const isBalanceGuardRefusal =
    isAppError(annulerMutation.error) &&
    annulerMutation.error.kind === "validation" &&
    !reasonError &&
    !!annulerMutation.error.fieldErrors;

  const errorMessage =
    isAppError(annulerMutation.error) && !reasonError
      ? annulerMutation.error.kind === "permission"
        ? "You do not have permission to cancel this cheque."
        : isBalanceGuardRefusal
          ? "This cheque could not be cancelled: the agent's balance no longer covers the amount to reverse."
          : "This cheque could not be cancelled. It may no longer be approved."
      : undefined;

  return (
    <ConfirmActionDialog
      open={cheque !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          annulerMutation.reset();
          setReason("");
        }
        onOpenChange(open);
      }}
      title="Cancel cheque"
      cancelLabel="Keep approved"
      description={
        cheque
          ? `Cancel cheque "${cheque.numCheque}"? Its amount is reversed from the agent's advance. This cannot be undone.`
          : null
      }
      confirmLabel="Cancel cheque"
      pendingLabel="Cancelling…"
      onConfirm={onConfirm}
      isPending={annulerMutation.isPending}
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
