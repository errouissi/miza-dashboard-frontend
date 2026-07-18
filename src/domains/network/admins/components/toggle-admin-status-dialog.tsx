import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useToggleAdminStatusMutation } from "../queries/admins-queries";
import type { Admin } from "../model/admin";

/**
 * Confirmation before blocking or activating an admin account.
 *
 * IT CONFIRMS EVEN THOUGH THE ACTION IS REVERSIBLE. Blocking an administrator
 * locks a colleague out of the system immediately; that it can be undone afterwards
 * does not make it a click worth doing by accident.
 *
 * Note this is `ConfirmActionDialog`'s first NON-DELETE caller. The component was
 * extracted from three delete dialogs, and reusing it here without modification is
 * the evidence that it is genuinely a confirm-action dialog rather than a delete
 * dialog wearing a general name.
 */
type ToggleAdminStatusDialogProps = {
  /** Absent = closed. Present = confirm toggling this one. */
  admin?: Admin;
  onOpenChange: (open: boolean) => void;
};

export function ToggleAdminStatusDialog({
  admin,
  onOpenChange,
}: ToggleAdminStatusDialogProps) {
  const toggleMutation = useToggleAdminStatusMutation();

  const onConfirm = () => {
    if (!admin) return;
    toggleMutation.mutate(admin.id, { onSuccess: () => onOpenChange(false) });
  };

  // The wording follows what the action will DO, not the current state — "Block"
  // on an active account, "Activate" on a blocked one.
  const willBlock = admin?.isActive === true;

  return (
    <ConfirmActionDialog
      open={admin !== undefined}
      onOpenChange={(open) => {
        if (!open) toggleMutation.reset();
        onOpenChange(open);
      }}
      title={willBlock ? "Block admin" : "Activate admin"}
      description={
        admin
          ? willBlock
            ? `Block “${admin.name}”? They will not be able to sign in until reactivated.`
            : `Activate “${admin.name}”? They will be able to sign in again.`
          : null
      }
      confirmLabel={willBlock ? "Block" : "Activate"}
      pendingLabel={willBlock ? "Blocking…" : "Activating…"}
      onConfirm={onConfirm}
      isPending={toggleMutation.isPending}
      errorMessage={
        isAppError(toggleMutation.error)
          ? "This account's status could not be changed."
          : undefined
      }
    />
  );
}
