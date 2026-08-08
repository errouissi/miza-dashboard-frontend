import {
  isAppError,
  lookupErrorCode,
  resolveErrorDisplay,
} from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  useAgentTransferFreshnessQuery,
  useValidateAgentTransferMutation,
} from "../queries/agent-transfers-queries";
import type { AgentTransfer } from "../model/agent-transfer";

/**
 * Confirmation before validating an Agent Transfer (roadmap M5, Phase 2) —
 * a PLAIN CONFIRM, no payload: `ValidateAgentTransferRequest`'s own
 * `rules()` returns an empty array (verified from source), all business
 * logic (manager stock floor check, commercial grattage-capacity check,
 * outstanding-obligation restock gate, binding re-assert under lock,
 * materialization) lives in `StockService::validateTransfer`.
 *
 * `variant="default"` — validating is an affirmative action, mirroring
 * `ValidateReturnDialog`'s own reasoning.
 *
 * ERROR-CODE REGISTRY — a failed validate can 409/422 with any of the 15
 * `TRANSFER_*`/`AGENT_TRANSFER_*` codes this phase registers in
 * `error-code-registry.ts`, INCLUDING the two Transfer-only gates
 * (`AGENT_TRANSFER_EXCEEDS_CAPACITY`, `TRANSFER_RECIPIENT_HAS_OUTSTANDING_
 * OBLIGATION`) `resolveErrorDisplay` surfaces with no special-casing needed
 * here — the registry already carries their copy.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — re-verifies `status` the
 * instant the dialog opens, via `useAgentTransferFreshnessQuery` (its OWN
 * cache key — see that hook's own docblock for why sharing the detail key
 * would let a transient verification failure corrupt the host page's own
 * display). A failed verification BLOCKS confirm, per explicit product
 * decision.
 *
 * `restockGateBlocked` (M6 Phase 3) — the Grattage restock gate for the
 * recipient COMMERCIAL's own obligation (`OUTSTANDING_GRATTAGE`), read by
 * the DETAIL PAGE via `useGrattageRestockGateQuery(agentTransfer
 * .commercialId)` and passed down as a plain boolean. Deliberately kept
 * SEPARATE from `useFreshConfirm` above — this is a foreign-domain
 * (Grattage) advisory read, not this transfer's own record staleness, and
 * the backend's own `StockService::validateTransfer` remains the sole
 * authority; a stale or missing gate read never blocks confirm on its
 * own, only a confirmed-blocked one does. The registered copy
 * (`TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`) is reused verbatim via
 * `lookupErrorCode` so the proactive and reactive expressions of the same
 * fact can never drift apart.
 */
type ValidateTransferDialogProps = {
  /** Absent = closed. Present = confirm validating this transfer. */
  agentTransfer?: AgentTransfer;
  onOpenChange: (open: boolean) => void;
  /** Defaults to `false` — see the module docblock. */
  restockGateBlocked?: boolean;
};

export function ValidateTransferDialog({
  agentTransfer,
  onOpenChange,
  restockGateBlocked = false,
}: ValidateTransferDialogProps) {
  const validateMutation = useValidateAgentTransferMutation();

  const freshnessQuery = useAgentTransferFreshnessQuery(agentTransfer?.id ?? -1);
  const freshness = useFreshConfirm({
    open: agentTransfer !== undefined,
    current: agentTransfer,
    query: freshnessQuery,
    hasChanged: (fresh) => fresh.status !== "draft",
  });

  const onConfirm = () => {
    if (!agentTransfer || freshness.blocked || restockGateBlocked) return;
    validateMutation.mutate(agentTransfer.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const freshnessMessage = freshness.isStale
    ? "This transfer has already been processed."
    : freshness.isUnavailable
      ? "This transfer's current status could not be verified."
      : undefined;

  const restockGateMessage = restockGateBlocked
    ? lookupErrorCode("TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION")?.message
    : undefined;

  const mutationMessage = isAppError(validateMutation.error)
    ? validateMutation.error.kind === "permission"
      ? "You do not have permission to validate this transfer."
      : (resolveErrorDisplay(validateMutation.error).message ??
        "This transfer could not be validated. It may already have been processed.")
    : undefined;

  const errorMessage = freshnessMessage ?? restockGateMessage ?? mutationMessage;

  return (
    <ConfirmActionDialog
      open={agentTransfer !== undefined}
      onOpenChange={(open) => {
        if (!open) validateMutation.reset();
        onOpenChange(open);
      }}
      title="Validate transfer"
      description={
        agentTransfer
          ? `Validate transfer "${agentTransfer.transferNumber}"? This cannot be undone.`
          : null
      }
      confirmLabel="Validate"
      pendingLabel="Validating…"
      onConfirm={onConfirm}
      isPending={validateMutation.isPending}
      errorMessage={errorMessage}
      variant="default"
      confirmDisabled={freshness.blocked || restockGateBlocked}
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
