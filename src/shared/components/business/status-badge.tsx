import { cn } from "@/shared/lib/utils";

/**
 * The unified semantic status system (Design System §17): one badge
 * component, six tones, reused by every current and future module instead
 * of each domain inventing its own status palette.
 *
 * TONE, NEVER STRING. This component knows nothing about "manager status"
 * or "cheque status" — it takes a `tone` and a `label`, both supplied by the
 * caller. The backend mixes English (`draft`, `settled`) and French
 * (`en_attente`, `accepter`) status strings; mapping a raw string to a tone
 * is domain knowledge (CLAUDE.md: no business logic in `shared/`), so each
 * domain keeps its own `<Resource>_STATUS_TONES` map next to its existing
 * `<Resource>_STATUS_LABELS` map and passes the result in. The same business
 * meaning MUST get the same tone in every module (§17 rule 2) — that
 * consistency is enforced by every domain drawing from this one component
 * and this one `StatusTone` union, not by this component knowing any status
 * vocabulary itself.
 *
 * EXTRACTED AT M4.1, ahead of Money, from Managers/Commercials/Clients —
 * three resources with real status enums, at ADR-0006's stated threshold
 * since M3.4. Not built to their minimal shape (a plain conditionally-muted
 * `<span>`, all three call sites used the same one): Money's Cheques
 * (pending/approved/rejected/annuler) and Deposits (pending/validated/
 * rejected) need tones Network's binary "active vs not" styling never had
 * to express (warning, danger, muted-as-terminal vs neutral-as-not-yet) —
 * building the real six-tone system now, from the Design System's own
 * already-frozen spec, is what avoids re-doing this component at M4.2.
 *
 * A dot ALWAYS accompanies the label (§17 rule 3) — colour alone is never
 * the only signal. Muted is an outline, Neutral is a fill (§17 rule 4):
 * "not yet" and "no longer" are opposite ends of a lifecycle and operators
 * filter on exactly that difference.
 */
export type StatusTone = "neutral" | "warning" | "info" | "success" | "danger" | "muted";

export type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
};

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-400",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-400",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-400",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  // Outlined, not filled — the one tone that is visually distinct in KIND,
  // not just hue, per §17 rule 4.
  muted: "border border-muted-foreground/30 text-muted-foreground",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-secondary-foreground/60",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
