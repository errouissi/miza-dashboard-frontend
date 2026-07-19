import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import {
  useActivateManagerMutation,
  useBlockManagerMutation,
} from "../queries/managers-queries";
import type { Manager } from "../model/manager";

/**
 * Confirmation before blocking or activating a manager.
 *
 * TWO DISTINCT ACTIONS, NOT A TOGGLE, and that mirrors the backend rather than
 * simplifying it. `PUT /agents/{id}/block` and `PUT /agents/{id}/activate` are
 * separate endpoints behind separate permissions (`block-agent`, `activate-agent`),
 * and an operator can legitimately hold one and not the other. There IS a
 * `toggle-status` endpoint, deliberately unused: it flips active↔blocked only, so
 * it cannot express the third status (`inactive`) and would silently activate an
 * inactive account that the operator meant to block.
 *
 * The caller decides which action is OFFERED, because the backend 400s on a no-op:
 * `block()` refuses an already-blocked account and `activate()` an already-active
 * one. An `inactive` manager can legitimately receive either.
 *
 * DELETE IS NOT OFFERED ANYWHERE IN THIS DOMAIN. `AgentController::destroy` sets
 * `status = 'blocked'` — it is byte-for-byte the same outcome as `block()`, behind
 * a different permission. Rendering both would offer an operator two buttons that
 * do the same thing while one of them says "delete", which is a lie about what
 * happens to the record (BC-R).
 */
type ManagerStatusAction = "block" | "activate";

type ManagerStatusDialogProps = {
  /** Absent = closed. Present = confirm this action on this manager. */
  manager?: Manager;
  action: ManagerStatusAction;
  onOpenChange: (open: boolean) => void;
};

export function ManagerStatusDialog({
  manager,
  action,
  onOpenChange,
}: ManagerStatusDialogProps) {
  const blockMutation = useBlockManagerMutation();
  const activateMutation = useActivateManagerMutation();

  const isBlock = action === "block";
  const mutation = isBlock ? blockMutation : activateMutation;

  const onConfirm = () => {
    if (!manager) return;
    mutation.mutate(manager.id, { onSuccess: () => onOpenChange(false) });
  };

  const fullName = manager ? `${manager.prenom} ${manager.nom}` : "";

  return (
    <ConfirmActionDialog
      open={manager !== undefined}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
      title={isBlock ? "Block manager" : "Activate manager"}
      description={
        manager
          ? isBlock
            ? `Block “${fullName}”? They will not be able to sign in until reactivated. Their commercials and history are kept.`
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
