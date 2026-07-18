import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useDeleteVilleMutation } from "../queries/villes-queries";
import type { Ville } from "../model/ville";

/**
 * Delete confirmation for a ville (Design System §19).
 *
 * The presentation is `ConfirmActionDialog` (extracted in M2c). What stays here is
 * everything that is about VILLES: the mutation, the copy, and the naming of the
 * record in the prompt.
 *
 * A ville that still has secteurs cannot be deleted: the backend has no guard and
 * the foreign key refuses it, surfacing as a generic server failure rather than a
 * clean "this city is in use" refusal (BC-B). The copy stays hedged rather than
 * inventing a cause the contract cannot confirm.
 */
type DeleteVilleDialogProps = {
  /** Absent = closed. Present = confirm deleting this one. */
  ville?: Ville;
  onOpenChange: (open: boolean) => void;
};

export function DeleteVilleDialog({ ville, onOpenChange }: DeleteVilleDialogProps) {
  const deleteMutation = useDeleteVilleMutation();

  const onConfirm = () => {
    if (!ville) return;
    deleteMutation.mutate(ville.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ConfirmActionDialog
      open={ville !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
      title="Delete city"
      description={ville ? `Delete “${ville.nomVille}”? This cannot be undone.` : null}
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      isPending={deleteMutation.isPending}
      errorMessage={
        isAppError(deleteMutation.error)
          ? "This city could not be deleted. It may still be in use."
          : undefined
      }
    />
  );
}
