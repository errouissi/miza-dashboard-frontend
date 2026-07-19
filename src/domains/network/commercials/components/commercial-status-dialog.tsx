import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import {
  useActivateCommercialMutation,
  useBlockCommercialMutation,
} from "../queries/commercials-queries";
import type { Commercial } from "../model/commercial";

/**
 * Confirmation before blocking or activating a commercial.
 *
 * TWO DISTINCT ACTIONS, NOT A TOGGLE — identical reasoning to Managers'
 * dialog. `PUT /agents/{id}/block` and `PUT /agents/{id}/activate` are
 * separate endpoints behind separate permissions, and `toggle-status` is
 * deliberately unused (cannot express the third status, `inactive`).
 *
 * The caller decides which action is OFFERED, because the backend 400s on a
 * no-op: `block()` refuses an already-blocked account and `activate()` an
 * already-active one.
 *
 * DELETE IS NOT OFFERED ANYWHERE IN THIS DOMAIN — `destroy()` sets
 * `status = 'blocked'`, identical to `block()` (BC-R), same as Managers.
 */
type CommercialStatusAction = "block" | "activate";

type CommercialStatusDialogProps = {
  /** Absent = closed. Present = confirm this action on this commercial. */
  commercial?: Commercial;
  action: CommercialStatusAction;
  onOpenChange: (open: boolean) => void;
};

export function CommercialStatusDialog({
  commercial,
  action,
  onOpenChange,
}: CommercialStatusDialogProps) {
  const blockMutation = useBlockCommercialMutation();
  const activateMutation = useActivateCommercialMutation();

  const isBlock = action === "block";
  const mutation = isBlock ? blockMutation : activateMutation;

  const onConfirm = () => {
    if (!commercial) return;
    mutation.mutate(commercial.id, { onSuccess: () => onOpenChange(false) });
  };

  const fullName = commercial ? `${commercial.prenom} ${commercial.nom}` : "";

  return (
    <ConfirmActionDialog
      open={commercial !== undefined}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
      title={isBlock ? "Block commercial" : "Activate commercial"}
      description={
        commercial
          ? isBlock
            ? `Block “${fullName}”? They will not be able to sign in until reactivated. Their client history is kept.`
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
