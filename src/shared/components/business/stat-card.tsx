import { cn } from "@/shared/lib/utils";

/**
 * The design-system-specified KPI tile (`phase8-design-system.html` §5:
 * "KPI numeral — 28 / 34 · bold · tabular · stat tiles only"), built at
 * its first real caller (M7 Overview Phase 2's Statistics panel) —
 * deliberately the SMALLEST shape that satisfies both the documented spec
 * and that one caller, not a speculatively-generalized dashboard-widget
 * API (CLAUDE.md: no premature shared abstractions).
 *
 * TAKES A `string | number` VALUE, RENDERED VERBATIM — never formats,
 * parses, or rounds it. A genuinely numeric count (`9`) and a
 * backend-computed decimal string (`"500.00"`, Statistics' own
 * `totalSolde`/`totalCash`) are both valid inputs; this component applies
 * only `tabular-nums` styling, the same "the caller owns formatting, this
 * component owns only what's true of a KPI tile everywhere it appears"
 * boundary `MoneyAmount` already holds. Do not reach for `MoneyAmount`
 * here for a decimal-string value — that would parse it through JS number
 * semantics, exactly what this domain's own backend-decimal convention
 * forbids (see `model/dashboard-statistics.ts`).
 *
 * `secondary` is optional, deliberately not required — most of Statistics'
 * own nine cards need no supporting line, and the design system names it
 * as "optional... only if genuinely useful", not a standard slot every
 * caller must fill.
 */
export type StatCardProps = {
  label: string;
  value: string | number;
  secondary?: string;
  className?: string;
};

export function StatCard({ label, value, secondary, className }: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border p-4", className)}>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="text-[28px] leading-[34px] font-bold tabular-nums">{value}</span>
      {secondary ? (
        <span className="text-muted-foreground text-xs">{secondary}</span>
      ) : null}
    </div>
  );
}
