import { useEffect, useId, useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/components/ui/button";

/**
 * A file upload control — preview/replace/remove wrapper around a native
 * file input (Architecture §7, FTA §4's `shared/components/business`).
 *
 * PROMOTED FROM `domains/network/agent-onboarding/` (M4.1). It shipped
 * domain-local at M3.6 because its ~11 call sites were all same-screen
 * repetition inside one wizard, not cross-resource evidence (ADR-0006's
 * Rule-of-Three is about the latter). Money's Cheque/Deposit/Debt Payment
 * submission forms are each a genuinely separate resource that also uploads
 * a file — the second, third and fourth callers Rule-of-Three actually asks
 * for — so this is promoted now, not speculatively.
 *
 * `existingUrl` (M7 Phase 1.5) — ADDITIVE AND BACKWARD-COMPATIBLE. Every one
 * of the onboarding wizard's ~11 callers passes no such prop and renders
 * exactly as before: `undefined`/`null` behaves identically to how this
 * component always worked. Added for Agent Edit, the first EDIT (not
 * create-only) caller — a field can now have a file already on the backend
 * before the operator ever opens the form, which `value: File | null` alone
 * cannot represent (a `File` cannot be constructed from a remote URL without
 * fetching and re-encoding it, which this component deliberately never does
 * — see below).
 *
 * PREVIEW PRECEDENCE, straightforward and total: a locally selected `value`
 * always wins over `existingUrl` (the operator is actively replacing);
 * `existingUrl` renders only when `value` is null/undefined. Clicking
 * "Remove" (which has always meant "clear the local selection", never
 * "delete anything") therefore has the CORRECT new meaning for free in edit
 * mode: it reverts the preview to `existingUrl`, because that is what
 * rendering falls back to the instant `value` becomes null again — no extra
 * "reverted" state needed. There is still no way to remove the file
 * ENTIRELY (no bare delete): the backend has no such capability
 * (`AgentController::update` only ever replaces or leaves a file untouched),
 * so this component does not offer a way to express "delete, keep nothing".
 *
 * NEVER SYNTHESIZES A `File` FROM `existingUrl`. The value this component
 * reports via `onChange` is always either a real, locally-selected `File` or
 * `null` — exactly as before. A caller that sees `null` after the operator
 * has been shown an existing-file preview must OMIT that field from its
 * submission (preserving the backend's own value), never fabricate a File
 * to resend one that was never actually re-selected.
 *
 * Image preview: `existingUrl` renders as an `<img>` when it looks like an
 * image (checked by extension — this component has no MIME info for a
 * remote URL, only its path); anything else renders as a plain "View
 * current file" link, mirroring the plain document links already used
 * elsewhere for the same class of value (e.g. `AgentWorkspacePage`'s own
 * document list). A newly selected local `File` previews the same way,
 * keyed off `file.type` (real MIME info, available for a local `File`) via
 * `URL.createObjectURL` — created and revoked in an effect so the object URL
 * never leaks across a replace/unmount.
 *
 * PRESENTATION ONLY, same boundary `ConfirmActionDialog` and `FormDrawer`
 * already hold in `shared/`: it owns no validation rule, no size cap, no
 * accepted-MIME list of its own — every one of those is domain knowledge
 * (a Cheque photo's 2MB image-only limit is not a Deposit proof's 5MB
 * image-or-PDF limit) and arrives from the caller via `accept`/`error`.
 *
 * The label's own text IS the click target (a real `<label htmlFor>`,
 * styled as a button) rather than a separate "Browse" affordance next to a
 * differently-worded description — one real label, one accessible name, no
 * ambiguity between the two.
 *
 * No drag-and-drop zone: Design System §12 describes one, but a click-to-
 * browse control with replace/remove already satisfies the substantive
 * requirements (named slots, accepted-type and size caps stated up front,
 * replace/remove actions) without building drag-and-drop machinery no
 * caller has asked for yet.
 */
export type FileUploadFieldProps = {
  label: string;
  required: boolean;
  accept: string;
  helperText?: string;
  value: File | null | undefined;
  onChange: (file: File | null) => void;
  error?: string;
  /**
   * The file already on the backend, if any — rendered only while `value`
   * is null/undefined. Omit entirely for a create-only caller (unchanged
   * behavior). See the module docblock for the full contract.
   */
  existingUrl?: string | null;
};

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;

function looksLikeImageUrl(url: string): boolean {
  return IMAGE_EXTENSION.test(url);
}

/**
 * Local-file preview URL, derived (never set as state) so its creation is
 * synchronous with render; a separate effect owns ONLY the revocation, tied
 * to the SAME memoized value, so the previous URL is freed the instant a
 * new one replaces it (or on unmount) without ever calling `setState`
 * inside an effect body.
 */
function useObjectUrl(file: File | null | undefined): string | undefined {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

export function FileUploadField({
  label,
  required,
  accept,
  helperText,
  value,
  onChange,
  error,
  existingUrl,
}: FileUploadFieldProps) {
  const inputId = useId();
  const localPreviewUrl = useObjectUrl(value);
  const isLocalImage = !!value && value.type.startsWith("image/");
  const isExistingImage = !!existingUrl && looksLikeImageUrl(existingUrl);

  // Local-selection precedence, computed once (module docblock's own rule):
  // a real File always wins over existingUrl.
  const previewUrl = value ? localPreviewUrl : (existingUrl ?? undefined);
  const previewIsImage = value ? isLocalImage : isExistingImage;
  const statusText = value
    ? value.name
    : existingUrl
      ? "Current file on record"
      : "No file chosen";
  const previewLinkLabel = value ? "Preview selected file" : "View current file";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept={accept}
          aria-invalid={!!error}
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
        <label
          htmlFor={inputId}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer",
          )}
        >
          {label}
          {required ? null : " (optional)"}
        </label>
        {/*
         * Both the status text and the Remove button are ALWAYS mounted —
         * only their text/`hidden` state changes across `value`/`existingUrl`
         * transitions. Swapping between a bare `<span>` and a `<>` fragment
         * containing `<span>+<Button>` (the previous shape) removes and
         * re-inserts DOM nodes on every file selection. Inside a Radix
         * `Dialog`, that removal — landing while focus is transiently on
         * `document.body` during the native OS file-picker round trip —
         * trips `FocusScope`'s own recovery heuristic (it watches the
         * dialog's subtree via `MutationObserver` and forcibly refocuses the
         * dialog container the instant it sees a removed node while focus
         * looks "lost"), yanking focus away from wherever the operator was
         * scrolled to. Keeping the node count and types stable — attribute
         * patches only — never gives that observer a `removedNodes` event to
         * react to.
         */}
        <span className="text-muted-foreground max-w-56 truncate text-sm">
          {statusText}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          hidden={!value}
          onClick={() => onChange(null)}
        >
          Remove
        </Button>
      </div>

      {/*
       * Same reasoning as the row above: one `<img>` and one `<a>`, always
       * mounted, `hidden` toggled rather than swapped in and out — an
       * existing-image preview replaced by a newly selected image now
       * reuses the same `<img>` node (a plain `src` update) instead of
       * tearing down and rebuilding across an `<img>`/`<a>`/nothing
       * three-way conditional.
       */}
      <img
        src={previewIsImage ? previewUrl : undefined}
        alt={previewUrl ? (value ? `${label} preview` : `${label} — current file`) : ""}
        hidden={!previewUrl || !previewIsImage}
        className="h-24 w-24 rounded-md border object-cover"
      />
      <a
        href={!previewIsImage ? previewUrl : undefined}
        target="_blank"
        rel="noreferrer"
        hidden={!previewUrl || previewIsImage}
        className="text-primary text-sm underline underline-offset-4"
      >
        {previewLinkLabel}
      </a>

      {helperText && !error ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
