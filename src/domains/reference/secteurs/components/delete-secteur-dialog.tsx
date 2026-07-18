import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useDeleteSecteurMutation } from "../queries/secteurs-queries";
import type { Secteur } from "../model/secteur";

/**
 * Delete confirmation for a secteur (Design System §19).
 *
 * Presentation is `ConfirmActionDialog` (extracted in M2c); what stays here is
 * everything about SECTEURS — the mutation, the copy, the named record.
 *
 * `SecteurController::destroy()` has no in-use guard, so a secteur still
 * referenced elsewhere fails as an unhandled FK violation (a 500), not as a clean
 * refusal (BC-I). The copy is hedged accordingly.
 */
type DeleteSecteurDialogProps = {
  /** Absent = closed. Present = confirm deleting this one. */
  secteur?: Secteur;
  onOpenChange: (open: boolean) => void;
};

export function DeleteSecteurDialog({ secteur, onOpenChange }: DeleteSecteurDialogProps) {
  const deleteMutation = useDeleteSecteurMutation();

  const onConfirm = () => {
    if (!secteur) return;
    deleteMutation.mutate(secteur.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ConfirmActionDialog
      open={secteur !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
      title="Delete sector"
      description={
        secteur ? `Delete “${secteur.nomSecteur}”? This cannot be undone.` : null
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      isPending={deleteMutation.isPending}
      errorMessage={
        isAppError(deleteMutation.error)
          ? "This sector could not be deleted. It may still be in use."
          : undefined
      }
    />
  );
}
