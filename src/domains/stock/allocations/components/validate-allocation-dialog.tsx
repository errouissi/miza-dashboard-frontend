import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useAllocationFreshnessQuery,
  useValidateAllocationMutation,
} from "../queries/allocations-queries";
import type { Allocation } from "../model/allocation";

/**
 * Confirmation before validating an Allocation (roadmap M5, Phase 4) —
 * a PLAIN CONFIRM, no payload: `ValidateAllocationRequest`'s own `rules()`
 * returns an empty array (verified from source). All business logic
 * (deposit-capacity gate, team outstanding-obligation restock gate, FIFO
 * deposit draw, stock materialization) lives in
 * `StockService::validateAllocation`.
 *
 * `variant="default"` — validating is an affirmative action, mirroring
 * `ValidateReturnDialog`'s/`ValidateTransferDialog`'s own reasoning.
 *
 * ERROR-CODE REGISTRY — a failed validate can 409/422 with any of the 10
 * `ALLOCATION_*` codes this phase registers in `error-code-registry.ts`,
 * INCLUDING the two Allocation-only gates
 * (`ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY`,
 * `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION`) `resolveErrorDisplay`
 * surfaces with no special-casing needed here — the registry already
 * carries their copy.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — re-verifies `status` the
 * instant the dialog opens, via `useAllocationFreshnessQuery` (its OWN
 * cache key — see that hook's own docblock for why sharing the detail key
 * would let a transient verification failure corrupt the host page's own
 * display). A failed verification BLOCKS confirm, per explicit product
 * decision.
 */
type ValidateAllocationDialogProps = {
  /** Absent = closed. Present = confirm validating this allocation. */
  allocation?: Allocation;
  onOpenChange: (open: boolean) => void;
};

export function ValidateAllocationDialog({
  allocation,
  onOpenChange,
}: ValidateAllocationDialogProps) {
  const validateMutation = useValidateAllocationMutation();

  const freshnessQuery = useAllocationFreshnessQuery(allocation?.id ?? -1);
  const freshness = useFreshConfirm({
    open: allocation !== undefined,
    current: allocation,
    query: freshnessQuery,
    hasChanged: (fresh) => fresh.status !== "draft",
  });

  const onConfirm = () => {
    if (!allocation || freshness.blocked) return;
    validateMutation.mutate(allocation.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const freshnessMessage = freshness.isStale
    ? "This allocation has already been processed."
    : freshness.isUnavailable
      ? "This allocation's current status could not be verified."
      : undefined;

  const mutationMessage = isAppError(validateMutation.error)
    ? validateMutation.error.kind === "permission"
      ? "You do not have permission to validate this allocation."
      : (resolveErrorDisplay(validateMutation.error).message ??
        "This allocation could not be validated. It may already have been processed.")
    : undefined;

  const errorMessage = freshnessMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={allocation !== undefined}
      onOpenChange={(open) => {
        if (!open) validateMutation.reset();
        onOpenChange(open);
      }}
      title="Validate allocation"
      description={
        allocation
          ? `Validate allocation "${allocation.allocationNumber}"? This cannot be undone.`
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
