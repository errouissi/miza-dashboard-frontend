import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useDeleteSecteurMutation } from "../queries/secteurs-queries";
import type { Secteur } from "../model/secteur";

/**
 * Delete confirmation (Design System §19).
 *
 * The sector is NAMED — confirming something you cannot verify is how the wrong
 * row gets deleted.
 *
 * `SecteurController::destroy()` has no in-use guard, so a secteur still
 * referenced elsewhere fails as an unhandled FK violation (a 500), not as a clean
 * refusal. The copy is hedged accordingly rather than claiming a cause the
 * contract cannot confirm.
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

  const failed = isAppError(deleteMutation.error);

  return (
    <Sheet
      open={secteur !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Delete sector</SheetTitle>
          <SheetDescription>
            {secteur ? `Delete “${secteur.nomSecteur}”? This cannot be undone.` : null}
          </SheetDescription>
        </SheetHeader>

        {failed ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            This sector could not be deleted. It may still be in use.
          </p>
        ) : null}

        <SheetFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
