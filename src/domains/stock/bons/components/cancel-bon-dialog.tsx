import { useState } from "react";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import { useBonFreshnessQuery, useCancelBonMutation } from "../queries/bons-queries";
import type { Bon } from "../model/bon";

const MIN_REASON_LENGTH = 10;

/**
 * Confirmation before cancelling a Bon (roadmap M5, Phase 5) — the ONLY
 * cancel lifecycle anywhere in Stock (BC-AB: only Bons has a `/cancel`
 * route). Reuses `ConfirmActionDialog`'s EXISTING `reason` slot
 * (`CancelBonRequest`: `cancellation_reason`, `required|string|min:10|
 * max:2000`) — the identical pattern `RejectChequeDialog`'s own
 * `decision_reason` already established; no new shared component needed.
 *
 * `variant="destructive"` (explicit, though it is also the component's own
 * default) — cancelling reverses already-materialized stock and is an
 * undo-shaped action, unlike Validate's affirmative one.
 *
 * MIN-LENGTH IS MIRRORED CLIENT-SIDE, NOT JUST `required` — the backend's
 * own rule is `min:10`, not merely non-empty (a genuine divergence from
 * Cheques' own `decision_reason`, which has no minimum). `confirmDisabled`
 * carries this extra check; `ConfirmActionDialog`'s own built-in
 * empty-value guard still covers the plain `required` half.
 *
 * `BON_CANCEL_STOCK_INSUFFICIENT` — a REAL, LIVE 409: the stock this bon
 * brought in may already have been drawn down elsewhere (e.g. a later
 * Allocation) by the time cancellation is attempted. Surfaced via
 * `resolveErrorDisplay`, no special-casing needed here — the registry
 * already carries its copy.
 *
 * FRESHNESS RULE — reuses `useBonFreshnessQuery`, the SAME query
 * `ValidateBonDialog` also reads (see `bonsKeys.freshness`'s own
 * docblock). This dialog's OWN `hasChanged` predicate
 * (`status !== "validated"`) is independent of Validate's own
 * (`status !== "draft"`) — sharing the underlying query does not couple
 * the two dialogs' business logic.
 */
type CancelBonDialogProps = {
  /** Absent = closed. Present = confirm cancelling this bon. */
  bon?: Bon;
  onOpenChange: (open: boolean) => void;
};

export function CancelBonDialog({ bon, onOpenChange }: CancelBonDialogProps) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelBonMutation();

  const freshnessQuery = useBonFreshnessQuery(bon?.id ?? -1);
  const freshness = useFreshConfirm({
    open: bon !== undefined,
    current: bon,
    query: freshnessQuery,
    hasChanged: (fresh) => fresh.status !== "validated",
  });

  const trimmedReason = reason.trim();
  const reasonTooShort =
    trimmedReason.length > 0 && trimmedReason.length < MIN_REASON_LENGTH;

  const onConfirm = () => {
    if (!bon || freshness.blocked || reasonTooShort) return;
    cancelMutation.mutate(
      { id: bon.id, reason: trimmedReason },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const serverReasonError = isAppError(cancelMutation.error)
    ? cancelMutation.error.fieldErrors?.cancellation_reason?.[0]
    : undefined;
  const reasonError =
    serverReasonError ??
    (reasonTooShort
      ? `Reason must be at least ${MIN_REASON_LENGTH} characters.`
      : undefined);

  const freshnessMessage = freshness.isStale
    ? "This bon is no longer validated — it may already have been cancelled."
    : freshness.isUnavailable
      ? "This bon's current status could not be verified."
      : undefined;

  const mutationMessage =
    isAppError(cancelMutation.error) && !serverReasonError
      ? cancelMutation.error.kind === "permission"
        ? "You do not have permission to cancel this bon."
        : (resolveErrorDisplay(cancelMutation.error).message ??
          "This bon could not be cancelled. It may already have been processed.")
      : undefined;

  const errorMessage = freshnessMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={bon !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          cancelMutation.reset();
          setReason("");
        }
        onOpenChange(open);
      }}
      title="Cancel bon"
      description={bon ? `Cancel bon "${bon.bonNumber}"? This cannot be undone.` : null}
      confirmLabel="Cancel bon"
      pendingLabel="Cancelling…"
      cancelLabel="Back"
      onConfirm={onConfirm}
      isPending={cancelMutation.isPending}
      errorMessage={errorMessage}
      variant="destructive"
      confirmDisabled={freshness.blocked || reasonTooShort}
      reason={{
        label: "Cancellation reason",
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
