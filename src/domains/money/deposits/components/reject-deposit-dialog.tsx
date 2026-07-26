import { useState } from "react";
import { isAppError } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useDepositFreshnessQuery,
  useRejectDepositMutation,
} from "../queries/deposits-queries";
import type { Deposit } from "../model/deposit";

const REJECT_REASON_MIN_LENGTH = 10;
const REJECT_REASON_MAX_LENGTH = 1000;

/**
 * Confirmation before rejecting a deposit (M4.3 Phase 3).
 *
 * `reject_reason` — re-verified fresh from source this phase
 * (`DepoController::reject`): `required|string|min:10|max:1000`. A MINIMUM
 * length, unlike Cheques' `decision_reason` (`required|string|max:1000`,
 * no minimum) — this dialog mirrors the backend's OWN limits EXACTLY
 * (both bounds), rather than reusing Cheques' weaker "just non-empty"
 * mirror. `confirmDisabled` carries this (a length check, not
 * `ConfirmActionDialog`'s own built-in `reasonMissing`, which only catches
 * the empty case) — the same generic escape hatch Approve's
 * allocation-sum check already established.
 *
 * The inline hint only appears once the operator has typed SOMETHING but
 * outside the bounds — an untouched, still-empty field shows no message,
 * the same silent-disablement precedent `RejectChequeDialog` already set
 * for its own (weaker) "must be non-empty" rule.
 *
 * A server-side 422 on the same field still maps to `reason.error`, not a
 * generic banner — same as `RejectChequeDialog`.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — `useFreshConfirm` re-verifies
 * this deposit's `status` the instant the dialog opens, via
 * `useDepositFreshnessQuery` (the SAME query key `useDepositQuery` reads,
 * so a fresh result also updates what `DepositDetailPage` itself shows).
 * `confirmDisabled` composes `freshness.blocked` with this dialog's own
 * `outOfBounds` reason-length check — either alone is enough to block.
 * A failed verification (network/server) BLOCKS rather than allows, per
 * explicit product decision: the whole point of this feature is to never
 * act on unverified data.
 */
type RejectDepositDialogProps = {
  /** Absent = closed. Present = confirm rejecting this deposit. */
  deposit?: Deposit;
  onOpenChange: (open: boolean) => void;
};

export function RejectDepositDialog({ deposit, onOpenChange }: RejectDepositDialogProps) {
  const [reason, setReason] = useState("");
  const rejectMutation = useRejectDepositMutation();

  const freshnessQuery = useDepositFreshnessQuery(deposit?.id ?? -1);
  const freshness = useFreshConfirm({
    open: deposit !== undefined,
    current: deposit,
    query: freshnessQuery,
    hasChanged: (fresh, snapshot) => fresh.status !== snapshot.status,
  });

  const trimmedLength = reason.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength < REJECT_REASON_MIN_LENGTH;
  const tooLong = trimmedLength > REJECT_REASON_MAX_LENGTH;
  const outOfBounds =
    trimmedLength < REJECT_REASON_MIN_LENGTH || trimmedLength > REJECT_REASON_MAX_LENGTH;

  const onConfirm = () => {
    if (!deposit || outOfBounds || freshness.blocked) return;
    rejectMutation.mutate(
      { id: deposit.id, rejectReason: reason },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const reasonError = isAppError(rejectMutation.error)
    ? rejectMutation.error.fieldErrors?.reject_reason?.[0]
    : undefined;

  const freshnessMessage = freshness.isStale
    ? "This deposit has already been processed."
    : freshness.isUnavailable
      ? "This deposit's current status could not be verified."
      : undefined;

  const errorMessage =
    freshnessMessage ??
    (isAppError(rejectMutation.error) && !reasonError
      ? rejectMutation.error.kind === "permission"
        ? "You do not have permission to reject this deposit."
        : "This deposit could not be rejected. It may already have been processed."
      : undefined);

  return (
    <ConfirmActionDialog
      open={deposit !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          rejectMutation.reset();
          setReason("");
        }
        onOpenChange(open);
      }}
      title="Reject deposit"
      description={
        deposit
          ? `Reject deposit "${deposit.receipt ?? `#${deposit.id}`}"? This cannot be undone.`
          : null
      }
      confirmLabel="Reject"
      pendingLabel="Rejecting…"
      onConfirm={onConfirm}
      isPending={rejectMutation.isPending}
      errorMessage={errorMessage}
      confirmDisabled={outOfBounds || freshness.blocked}
      reason={{
        label: "Reason",
        value: reason,
        onChange: setReason,
        error:
          reasonError ??
          (tooShort
            ? `Reason must be at least ${REJECT_REASON_MIN_LENGTH} characters.`
            : tooLong
              ? `Reason must be ${REJECT_REASON_MAX_LENGTH} characters or fewer.`
              : undefined),
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

// Exported for tests only, so the minimum stays a single source of truth
// rather than a magic number re-typed in the test file.
export { REJECT_REASON_MIN_LENGTH, REJECT_REASON_MAX_LENGTH };
