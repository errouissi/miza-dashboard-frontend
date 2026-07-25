import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";

/**
 * Confirmation before an action (Design System §19).
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
 *
 * `variant` (M4.2 Phase 3C) — EXTENDS this component rather than forking a
 * parallel one, per this phase's own instruction. All eight prior callers
 * (Villes/Secteurs/Products delete, Managers/Commercials/Clients status,
 * Admins toggle/delete) are destructive actions and stay on the default,
 * byte-for-byte unchanged. Approving a cheque is not: a red "destructive"
 * confirm button on an affirmative action would visually lie about what it
 * does (flagged as a known blocker in `next-session.md` before this phase
 * started). `"default"` renders the ordinary primary button style.
 *
 * `reason` (M4.2 Phase 3C) — an optional, OPTIONAL-TO-RENDER labeled
 * textarea between the description and the error banner, for actions whose
 * backend requires a free-text justification (`reject`/`annuler`'s own
 * `decision_reason`, `required|string|max:1000`). No prior caller needed
 * one; embedding an uncontrolled field inside `description` (a plain
 * `ReactNode`) would have worked, but a labeled, validated input recurring
 * identically across two real callers (Reject, Annuler) is exactly the
 * "genuinely required" bar this phase's instructions set for extending the
 * shared component instead. The confirm button is disabled whenever
 * `reason` is present and its `value` is empty/whitespace-only — the same
 * client-side mirror of the backend's `required` rule every form in this
 * app already applies before submitting.
 *
 * `confirmDisabled` (M4.2 Phase 3C, same phase — Approve's allocation
 * split) — a GENERIC escape hatch, not a cheque-specific one: the caller's
 * OWN validation (here, "rapped + grattage must equal the cheque amount")
 * is domain knowledge this component may not hold (FTA §4), so it cannot
 * be expressed as a named prop the way `reason` is. Rather than adding a
 * cheque-shaped prop (which WOULD leak business logic into `shared/`), this
 * stays a plain boolean the caller computes itself and hands in — the same
 * "presentation only, caller owns validity" boundary `reason`'s own
 * `required`-mirroring already established, generalised to an arbitrary
 * caller-side rule instead of just "is this field empty". Custom
 * allocation inputs themselves render via `children` (below), not
 * `description` — ONE single-caller need does not justify a second
 * cheque-shaped prop on top of `reason`.
 *
 * `children` (M4.2 Phase 3C, same phase) — a second, GENERIC escape hatch,
 * added alongside `confirmDisabled` for the same reason: Approve's
 * allocation inputs (a read-only amount plus two `<Input>`s) are BLOCK-level
 * markup, and `description` renders inside `SheetDescription`, which Radix
 * renders as a `<p>` — a `<div>`/nested `<p>` inside it is invalid HTML
 * (verified from the resulting console warning during this phase, not
 * assumed). `children` renders as an ordinary sibling after the header,
 * outside that `<p>`, for exactly this kind of custom block content.
 * `description` itself stays reserved for the short, inline text prompt
 * every other caller already gives it.
 */
export type ConfirmActionDialogVariant = "destructive" | "default";

export type ConfirmActionDialogReason = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Field-mapped 422 (e.g. the backend's own `max:1000`), shown inline under the textarea. */
  error?: string;
};

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
  /** `"destructive"` (default, unchanged) or `"default"` for an affirmative action. */
  variant?: ConfirmActionDialogVariant;
  /** A required free-text justification field. Omitted entirely when absent. */
  reason?: ConfirmActionDialogReason;
  /** Disables the confirm button on the caller's own validation, independent of `isPending`/`reason`. Defaults to `false`. */
  confirmDisabled?: boolean;
  /** Custom block-level content (read-only fields, inputs), rendered after the header, OUTSIDE `SheetDescription`'s `<p>`. Omitted entirely when absent. */
  children?: ReactNode;
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
  variant = "destructive",
  reason,
  confirmDisabled = false,
  children,
}: ConfirmActionDialogProps) {
  const reasonMissing = reason !== undefined && reason.value.trim() === "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {children ? <div className="flex flex-col gap-3 px-4">{children}</div> : null}

        {reason ? (
          <div className="flex flex-col gap-1.5 px-4">
            <label htmlFor="confirmActionReason" className="text-sm font-medium">
              {reason.label}
            </label>
            <Textarea
              id="confirmActionReason"
              value={reason.value}
              onChange={(event) => reason.onChange(event.target.value)}
              aria-invalid={!!reason.error}
              disabled={isPending}
            />
            {reason.error ? (
              <p role="alert" className="text-destructive text-xs">
                {reason.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-destructive px-4 text-sm">
            {errorMessage}
          </p>
        ) : null}

        <SheetFooter>
          <Button
            type="button"
            variant={variant}
            onClick={onConfirm}
            disabled={isPending || reasonMissing || confirmDisabled}
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
