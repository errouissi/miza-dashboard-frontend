import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import {
  useActivateAgentMutation,
  useBlockAgentMutation,
} from "../queries/agents-queries";
import type { Agent } from "../model/agent";

/**
 * Confirmation before blocking or activating an agent, from the Agent 360
 * workspace. Mirrors `ManagerStatusDialog`/`CommercialStatusDialog` exactly
 * (same two-action shape, same reasoning for why they are not a toggle) —
 * a fresh, parallel implementation against the identical backend endpoints,
 * not a shared import (both of those dialogs are private to their own
 * domains; see the M7 Phase 1 discovery pass and ADR-0012).
 *
 * TWO DISTINCT ACTIONS, NOT A TOGGLE — `PUT /agents/{id}/block` and
 * `PUT /agents/{id}/activate` are separate endpoints behind separate
 * permissions (`block-agent`, `activate-agent`), and an operator can
 * legitimately hold one and not the other. The caller decides which action
 * is OFFERED, because the backend 400s on a no-op.
 */
type AgentStatusAction = "block" | "activate";

type AgentStatusDialogProps = {
  /** Absent = closed. Present = confirm this action on this agent. */
  agent?: Agent;
  action: AgentStatusAction;
  onOpenChange: (open: boolean) => void;
};

export function AgentStatusDialog({
  agent,
  action,
  onOpenChange,
}: AgentStatusDialogProps) {
  const blockMutation = useBlockAgentMutation();
  const activateMutation = useActivateAgentMutation();

  const isBlock = action === "block";
  const mutation = isBlock ? blockMutation : activateMutation;

  const onConfirm = () => {
    if (!agent) return;
    mutation.mutate(agent.id, { onSuccess: () => onOpenChange(false) });
  };

  const fullName = agent ? `${agent.prenom} ${agent.nom}` : "";

  return (
    <ConfirmActionDialog
      open={agent !== undefined}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
      title={isBlock ? "Block agent" : "Activate agent"}
      description={
        agent
          ? isBlock
            ? `Block “${fullName}”? They will not be able to sign in until reactivated. Their history is kept.`
            : `Activate “${fullName}”? They will be able to sign in again.`
          : null
      }
      confirmLabel={isBlock ? "Block" : "Activate"}
      pendingLabel={isBlock ? "Blocking…" : "Activating…"}
      onConfirm={onConfirm}
      isPending={mutation.isPending}
      errorMessage={
        isAppError(mutation.error)
          ? "This account's status could not be changed."
          : undefined
      }
    />
  );
}
