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
import { useDeleteProductMutation } from "../queries/products-queries";
import type { Product } from "../model/product";

/**
 * Delete confirmation (Design System §19).
 *
 * The product is NAMED — confirming something you cannot verify is how the wrong
 * row gets deleted.
 *
 * `ProductController::destroy()` has no in-use guard, and `Product` carries THREE
 * inbound relations (grattage sales, stocks, stock movements) — more than any
 * other reference resource. A referenced product fails as an unhandled FK
 * violation (a 500), not as a clean refusal, so the copy is hedged rather than
 * claiming a cause the contract cannot confirm.
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

  const failed = isAppError(deleteMutation.error);

  return (
    <Sheet
      open={product !== undefined}
      onOpenChange={(open) => {
        if (!open) deleteMutation.reset();
        onOpenChange(open);
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Delete product</SheetTitle>
          <SheetDescription>
            {product ? `Delete “${product.name}”? This cannot be undone.` : null}
          </SheetDescription>
        </SheetHeader>

        {failed ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            This product could not be deleted. It may still be in use.
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
