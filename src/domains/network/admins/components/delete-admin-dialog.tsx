import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useDeleteAdminMutation } from "../queries/admins-queries";
import type { Admin } from "../model/admin";

/**
 * Delete confirmation for an admin (Design System §19).
 *
 * The account is NAMED — deleting the wrong administrator is not a recoverable
 * mistake, and "delete this admin?" asks an operator to confirm something they
 * cannot verify.
 *
 * THE BACKEND REFUSES TWO CASES WITH A 403, and they mean different things to the
 * operator, so they are distinguished rather than collapsed into one message:
 *   - deleting your own account ("You cannot delete your own account.")
 *   - deleting a super-admin (super-admins are excluded from this list, so this
 *     should be unreachable from the UI — handled anyway, because "should be
 *     unreachable" is not a guarantee)
 * The frontend cannot tell them apart from the status alone, so the copy covers
 * the reachable case and stays honest about the rest.
 */
type DeleteAdminDialogProps = {
  /** Absent = closed. Present = confirm deleting this one. */
  admin?: Admin;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAdminDialog({ admin, onOpenChange }: DeleteAdminDialogProps) {
  const deleteMutation = useDeleteAdminMutation();

  const onConfirm = () => {
    if (!admin) return;
    deleteMutation.mutate(admin.id, { onSuccess: () => onOpenChange(false) });
  };

  const error = deleteMutation.error;
  const errorMessage = isAppError(error)
    ? error.kind === "permission"
      ? "This account cannot be deleted. You cannot delete your own account."
      : "This account could not be deleted."
    : undefined;

  return (
    <ConfirmActionDialog
      open={admin !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
      title="Delete admin"
      description={
        admin ? `Delete “${admin.name}” (${admin.email})? This cannot be undone.` : null
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      isPending={deleteMutation.isPending}
      errorMessage={errorMessage}
    />
  );
}
