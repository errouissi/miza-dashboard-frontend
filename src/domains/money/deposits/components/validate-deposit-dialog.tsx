import { isAppError } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useDepositFreshnessQuery,
  useValidateDepositMutation,
} from "../queries/deposits-queries";
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
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — `useFreshConfirm` re-verifies
 * this deposit's `status` the instant the dialog opens, via
 * `useDepositFreshnessQuery` (its OWN cache key, deliberately distinct from
 * `useDepositQuery`'s — see that hook's own docblock for why sharing the
 * key would let a transient verification failure corrupt the host page's
 * own display). A failed verification BLOCKS confirm rather than allowing
 * it, per explicit product decision.
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

  const freshnessQuery = useDepositFreshnessQuery(deposit?.id ?? -1);
  const freshness = useFreshConfirm({
    open: deposit !== undefined,
    current: deposit,
    query: freshnessQuery,
    hasChanged: (fresh, snapshot) => fresh.status !== snapshot.status,
  });

  const onConfirm = () => {
    if (!deposit || freshness.blocked) return;
    validateMutation.mutate(deposit.id, { onSuccess: () => onOpenChange(false) });
  };

  const freshnessMessage = freshness.isStale
    ? "This deposit has already been processed."
    : freshness.isUnavailable
      ? "This deposit's current status could not be verified."
      : undefined;

  const errorMessage =
    freshnessMessage ??
    (isAppError(validateMutation.error)
      ? validateMutation.error.kind === "permission"
        ? "You do not have permission to validate this deposit."
        : "This deposit could not be validated. It may already have been processed."
      : undefined);

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
