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
  /**
   * An additional, caller-computed reason to disable Submit that is NOT
   * "pending" — e.g. Client 360's `ClientReassignDrawer` disabling Reassign
   * while the selected Commercial still equals the client's current one.
   * Defaults to `false`, so every existing caller is unaffected. The shell
   * only ORs it into the button's `disabled`; it never inspects why.
   */
  submitDisabled?: boolean;
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
  submitDisabled = false,
}: FormDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
       * `overflow-clip` here, plus `min-h-0 flex-1` on the form below and
       * on the scrollable field region, breaks the flexbox "min-height:auto"
       * trap: without it, a flex-column child never shrinks below its own
       * content's intrinsic height, so a field list taller than the sheet
       * simply pushes the sheet's fixed `h-full` bounds instead of scrolling
       * — the header and footer scroll away with it and become unreachable.
       * Short forms (Villes, Secteurs, …) are visually unaffected: when
       * content fits, `overflow-y-auto` shows no scrollbar and the footer
       * still sits at the bottom of the sheet exactly as before.
       *
       * `overflow-clip`, NOT `overflow-hidden` — a real runtime bug (M7,
       * manual QA), reproduced live in Chrome, not caught by any jsdom
       * test: `overflow: hidden` still makes an element a genuine SCROLL
       * CONTAINER per spec (real `scrollTop`, no scrollbar shown, no
       * user-driven wheel/drag scroll, but still a valid target for the
       * browser's native "scroll the focused element into view" behavior).
       * A file field's native `<input type="file">` regains focus the
       * instant the OS file picker returns a selection. That input sits
       * inside BOTH the intended `.overflow-y-auto` region below AND this
       * outer container — with `overflow-hidden` here, the browser's
       * focus-scroll walk adjusted THIS element's own `scrollTop` too
       * (confirmed live: 0 -> 920), on top of the inner region's already-
       * correct scroll, clipping the entire visible panel into blank space.
       * `overflow: clip` clips identically for containment but is
       * explicitly NOT a scroll container by spec — no `scrollTop` for
       * anything to hijack. Confirmed live in Chrome: selecting a
       * replacement Photo no longer moves this element's `scrollTop` from
       * 0, and the drawer stays fully visible and populated.
       */}
      <SheetContent side="right" className="overflow-clip">
        <SheetHeader className="shrink-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            {children}

            {errorMessage ? (
              <p role="alert" className="text-destructive text-sm">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-t px-4">
            <Button type="submit" disabled={isPending || submitDisabled}>
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
