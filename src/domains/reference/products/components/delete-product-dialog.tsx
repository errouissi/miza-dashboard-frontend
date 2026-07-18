import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useDeleteProductMutation } from "../queries/products-queries";
import type { Product } from "../model/product";

/**
 * Delete confirmation for a product (Design System §19).
 *
 * Presentation is `ConfirmActionDialog` (extracted in M2c); what stays here is
 * everything about PRODUCTS — the mutation, the copy, the named record.
 *
 * `ProductController::destroy()` has no in-use guard, and `Product` carries THREE
 * inbound relations (grattage sales, stocks, stock movements) — more than any
 * other reference resource. A referenced product fails as an unhandled FK
 * violation (a 500), not a clean refusal (BC-I), so the copy stays hedged.
 */
type DeleteProductDialogProps = {
  /** Absent = closed. Present = confirm deleting this one. */
  product?: Product;
  onOpenChange: (open: boolean) => void;
};

export function DeleteProductDialog({ product, onOpenChange }: DeleteProductDialogProps) {
  const deleteMutation = useDeleteProductMutation();

  const onConfirm = () => {
    if (!product) return;
    deleteMutation.mutate(product.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ConfirmActionDialog
      open={product !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
      title="Delete product"
      description={product ? `Delete “${product.name}”? This cannot be undone.` : null}
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      isPending={deleteMutation.isPending}
      errorMessage={
        isAppError(deleteMutation.error)
          ? "This product could not be deleted. It may still be in use."
          : undefined
      }
    />
  );
}
