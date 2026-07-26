import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useAgentStockReturnFreshnessQuery,
  useValidateAgentStockReturnMutation,
} from "../queries/agent-stock-returns-queries";
import type { AgentStockReturn } from "../model/agent-stock-return";

/**
 * Confirmation before validating an Agent Stock Return (roadmap M5, Phase
 * 1) — a PLAIN CONFIRM, no payload: `ValidateAgentStockReturnRequest`'s own
 * `rules()` returns an empty array (verified from source), all business
 * logic (stock floor check, binding re-assert under lock, materialization)
 * lives in `StockService::validateReturn`.
 *
 * `variant="default"` — validating is an affirmative action, mirroring
 * `ValidateDepositDialog`'s own reasoning.
 *
 * ERROR-CODE REGISTRY, FIRST REAL CALLER — a failed validate can 409/422
 * with any of the 13 `RETURN_*` codes this phase registers in
 * `error-code-registry.ts`. `resolveErrorDisplay` is used here for real
 * (every prior Money dialog hand-rolled its own copy because none of its
 * own failures carried a documented `code` — this is the first domain
 * where they genuinely do).
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — re-verifies `status` the
 * instant the dialog opens, via `useAgentStockReturnFreshnessQuery` (its
 * OWN cache key — see that hook's own docblock for why sharing the detail
 * key would let a transient verification failure corrupt the host page's
 * own display). A failed verification BLOCKS confirm, per explicit product
 * decision.
 */
type ValidateReturnDialogProps = {
  /** Absent = closed. Present = confirm validating this return. */
  agentStockReturn?: AgentStockReturn;
  onOpenChange: (open: boolean) => void;
};

export function ValidateReturnDialog({
  agentStockReturn,
  onOpenChange,
}: ValidateReturnDialogProps) {
  const validateMutation = useValidateAgentStockReturnMutation();

  const freshnessQuery = useAgentStockReturnFreshnessQuery(agentStockReturn?.id ?? -1);
  const freshness = useFreshConfirm({
    open: agentStockReturn !== undefined,
    current: agentStockReturn,
    query: freshnessQuery,
    hasChanged: (fresh) => fresh.status !== "draft",
  });

  const onConfirm = () => {
    if (!agentStockReturn || freshness.blocked) return;
    validateMutation.mutate(agentStockReturn.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const freshnessMessage = freshness.isStale
    ? "This stock return has already been processed."
    : freshness.isUnavailable
      ? "This stock return's current status could not be verified."
      : undefined;

  const mutationMessage = isAppError(validateMutation.error)
    ? validateMutation.error.kind === "permission"
      ? "You do not have permission to validate this stock return."
      : (resolveErrorDisplay(validateMutation.error).message ??
        "This stock return could not be validated. It may already have been processed.")
    : undefined;

  const errorMessage = freshnessMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={agentStockReturn !== undefined}
      onOpenChange={(open) => {
        if (!open) validateMutation.reset();
        onOpenChange(open);
      }}
      title="Validate stock return"
      description={
        agentStockReturn
          ? `Validate stock return "${agentStockReturn.returnNumber}"? This cannot be undone.`
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
