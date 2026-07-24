import { useId } from "react";
import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/components/ui/button";

/**
 * A LOCAL, domain-specific file upload control — not extracted into
 * `shared/`. Reused ~11 times within this one wizard (Documents' 7 slots,
 * Moto's 4), which is same-screen repetition inside a single flow, not
 * cross-resource evidence (ADR-0006's Rule-of-Three is about the latter).
 * Nothing else in the product uploads files yet, so there is no second
 * caller to generalize for.
 *
 * The label's own text IS the click target (a real `<label htmlFor>`,
 * styled as a button) rather than a separate "Browse" affordance next to a
 * differently-worded description — one real label, one accessible name, no
 * ambiguity between the two.
 *
 * No drag-and-drop zone: Design System §12 describes one, but a click-to-
 * browse control with replace/remove already satisfies the substantive
 * requirements (named slots, accepted-type and size caps stated up front,
 * replace/remove actions) without building drag-and-drop machinery this
 * milestone's scope does not ask for.
 */
export type FileUploadFieldProps = {
  label: string;
  required: boolean;
  accept: string;
  helperText?: string;
  value: File | null | undefined;
  onChange: (file: File | null) => void;
  error?: string;
};

export function FileUploadField({
  label,
  required,
  accept,
  helperText,
  value,
  onChange,
  error,
}: FileUploadFieldProps) {
  const inputId = useId();

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
        {value ? (
          <>
            <span className="text-muted-foreground max-w-56 truncate text-sm">
              {value.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">No file chosen</span>
        )}
      </div>
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
