import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";

/**
 * Confirmation before a destructive action (Design System §19).
 *
 * Extracted in M2c from three identical delete dialogs (Villes, Secteurs,
 * Products), which differed only in their labels and the field they named.
 *
 * PRESENTATION ONLY, and that boundary is what keeps it in shared/:
 *   - it owns no mutation, no query client, no domain type;
 *   - the caller owns the action and its pending/error state and passes both in.
 * A version that ran the mutation itself would need to know what it was deleting,
 * which is domain knowledge, and shared/ may hold none (FTA §4).
 *
 * `description` is a node rather than a string so the caller can NAME the record —
 * "Delete this?" asks an operator to confirm something they cannot verify, which
 * is how the wrong row gets deleted.
 *
 * `errorMessage` is copy the CALLER derives. This component does not inspect an
 * AppError: what a failure means ("it may still be in use") is domain knowledge.
 */
export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The prompt. Should identify the record by name, not by pronoun. */
  description?: ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while the action runs. */
  pendingLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  /** Rendered as an alert when present. Omitted entirely when absent. */
  errorMessage?: string;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  onConfirm,
  isPending = false,
  errorMessage,
}: ConfirmActionDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {errorMessage ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            {errorMessage}
          </p>
        ) : null}

        <SheetFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
