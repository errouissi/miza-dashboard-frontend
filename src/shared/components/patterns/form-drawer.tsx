import type { FormEventHandler, ReactNode } from "react";
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
 * The frame a create/edit drawer renders inside (Design System §18: a drawer is
 * a TASK).
 *
 * Extracted in M2c from three drawers whose SHELL was identical — Sheet, header,
 * form element, general-error slot, Save/Cancel footer with pending states — and
 * whose CONTENTS were not: Villes has one text input, Secteurs a text input plus
 * a relation select, Products a text input, an enum select and an integer field
 * behind a transforming schema.
 *
 * IT OWNS THE SHELL, NOT THE FORM. Specifically it does NOT own:
 *   - the zod schema, the fields, or any resource validation;
 *   - the react-hook-form instance;
 *   - the mutations, or the decision between create and update;
 *   - field-level error mapping (which field a 422 belongs to is domain knowledge).
 *
 * Those stay with the resource. What is shared is the part that was copied
 * verbatim three times and is easy to get subtly wrong: submit wiring, the
 * pending disable on BOTH buttons, and the footer's shape.
 *
 * The open/reset lifecycle stays with the caller too, deliberately. Re-seeding a
 * form on open requires knowing the form's shape and its defaults; a shell that
 * did it would have to own the form instance, and then it would own the fields.
 */
export type FormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The resource's fields. The shell never looks inside them. */
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  isPending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /**
   * A form-level failure, already turned into copy by the caller. Field-level
   * errors render against their fields, inside `children`.
   */
  errorMessage?: string;
};

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  isPending = false,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  cancelLabel = "Cancel",
  errorMessage,
}: FormDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4">
          {children}

          {errorMessage ? (
            <p role="alert" className="text-destructive text-sm">
              {errorMessage}
            </p>
          ) : null}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? pendingLabel : submitLabel}
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
        </form>
      </SheetContent>
    </Sheet>
  );
}
