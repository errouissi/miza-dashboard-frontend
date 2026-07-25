import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useValidateDepositMutation } from "../queries/deposits-queries";
import type { Deposit } from "../model/deposit";

/**
 * Confirmation before validating a deposit (M4.3 Phase 3).
 *
 * A PLAIN CONFIRM, no allocation split — unlike Cheques' `approve`, which
 * needed one. `DepoController::validateDepo` takes no payload at all for
 * either deposit type (verified fresh from source): the rapped/grattage
 * branching happens entirely server-side, keyed off the deposit's own
 * `type`, not anything the caller sends.
 *
 * `variant="default"` — validating is an affirmative action, not a
 * destructive one, same reasoning as `ApproveChequeDialog`.
 */
type ValidateDepositDialogProps = {
  /** Absent = closed. Present = confirm validating this deposit. */
  deposit?: Deposit;
  onOpenChange: (open: boolean) => void;
};

export function ValidateDepositDialog({
  deposit,
  onOpenChange,
}: ValidateDepositDialogProps) {
  const validateMutation = useValidateDepositMutation();

  const onConfirm = () => {
    if (!deposit) return;
    validateMutation.mutate(deposit.id, { onSuccess: () => onOpenChange(false) });
  };

  const errorMessage = isAppError(validateMutation.error)
    ? validateMutation.error.kind === "permission"
      ? "You do not have permission to validate this deposit."
      : "This deposit could not be validated. It may already have been processed."
    : undefined;

  return (
    <ConfirmActionDialog
      open={deposit !== undefined}
      onOpenChange={(open) => {
        if (!open) validateMutation.reset();
        onOpenChange(open);
      }}
      title="Validate deposit"
      description={
        deposit
          ? `Validate deposit "${deposit.receipt ?? `#${deposit.id}`}"? This cannot be undone.`
          : null
      }
      confirmLabel="Validate"
      pendingLabel="Validating…"
      onConfirm={onConfirm}
      isPending={validateMutation.isPending}
      errorMessage={errorMessage}
      variant="default"
    />
  );
}
