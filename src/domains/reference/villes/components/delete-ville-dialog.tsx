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
import { useDeleteVilleMutation } from "../queries/villes-queries";
import type { Ville } from "../model/ville";

/**
 * Delete confirmation (Design System §19).
 *
 * The city being deleted is NAMED in the prompt — "Delete this city?" asks the
 * operator to confirm something they cannot verify, which is how the wrong row
 * gets deleted.
 *
 * A ville that still has secteurs cannot be deleted: the backend has no guard for
 * this and the foreign key refuses it, which surfaces here as a generic server
 * failure rather than a clean "this city is in use" refusal. That gap is recorded
 * for backend consultation — this dialog deliberately does not invent a friendlier
 * message than the contract can support.
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

  const failed = isAppError(deleteMutation.error);

  return (
    <Sheet
      open={ville !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Delete city</SheetTitle>
          <SheetDescription>
            {ville ? `Delete “${ville.nomVille}”? This cannot be undone.` : null}
          </SheetDescription>
        </SheetHeader>

        {failed ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            This city could not be deleted. It may still be in use.
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
