import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import { useBonFreshnessQuery, useValidateBonMutation } from "../queries/bons-queries";
import type { Bon } from "../model/bon";

/**
 * Confirmation before validating a Bon (roadmap M5, Phase 5) — a PLAIN
 * CONFIRM, no payload: `ValidateBonRequest`'s own `rules()` returns an
 * empty array (verified from source). `StockService::validateBon` has NO
 * capacity or stock-sufficiency check at all — a bon is the SOURCE of
 * stock, not a consumer — so the only refusals are `BON_NOT_DRAFT`/
 * `BON_HAS_NO_LINES`.
 *
 * `variant="default"` — validating is an affirmative action, mirroring
 * every prior Stock validate dialog's own reasoning.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — reuses `useBonFreshnessQuery`,
 * the SAME query `CancelBonDialog` also reads (see `bonsKeys.freshness`'s
 * own docblock). This dialog's OWN `hasChanged` predicate
 * (`status !== "draft"`) is independent of Cancel's own
 * (`status !== "validated"`) — sharing the underlying query does not
 * couple the two dialogs' business logic.
 */
type ValidateBonDialogProps = {
  /** Absent = closed. Present = confirm validating this bon. */
  bon?: Bon;
  onOpenChange: (open: boolean) => void;
};

export function ValidateBonDialog({ bon, onOpenChange }: ValidateBonDialogProps) {
  const validateMutation = useValidateBonMutation();

  const freshnessQuery = useBonFreshnessQuery(bon?.id ?? -1);
  const freshness = useFreshConfirm({
    open: bon !== undefined,
    current: bon,
    query: freshnessQuery,
    hasChanged: (fresh) => fresh.status !== "draft",
  });

  const onConfirm = () => {
    if (!bon || freshness.blocked) return;
    validateMutation.mutate(bon.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const freshnessMessage = freshness.isStale
    ? "This bon has already been processed."
    : freshness.isUnavailable
      ? "This bon's current status could not be verified."
      : undefined;

  const mutationMessage = isAppError(validateMutation.error)
    ? validateMutation.error.kind === "permission"
      ? "You do not have permission to validate this bon."
      : (resolveErrorDisplay(validateMutation.error).message ??
        "This bon could not be validated. It may already have been processed.")
    : undefined;

  const errorMessage = freshnessMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={bon !== undefined}
      onOpenChange={(open) => {
        if (!open) validateMutation.reset();
        onOpenChange(open);
      }}
      title="Validate bon"
      description={bon ? `Validate bon "${bon.bonNumber}"? This cannot be undone.` : null}
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
