import { formatDate } from "@/shared/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { DepositSubmissionPoint } from "../model/dashboard-chart-data";

/**
 * M7 Overview Phase 3 — a small, purpose-built SVG bar chart for
 * "Deposit Submissions" — the FIRST of exactly two chart callers this
 * phase adds. Not a generic charting primitive: no pie/zoom/pan/brush,
 * no arbitrary dataset support, no configurable engine — CLAUDE.md's
 * "no premature shared abstraction" rule applies here as much as it
 * would to a promoted `shared/` component, so this stays a small,
 * explicit, domain-local component built for exactly this one series
 * shape. See `next-session.md`'s own Phase 3 discovery report for why a
 * chart LIBRARY was rejected for this scope (bundle cost already
 * flagged, no zoom/pan/brush requirement, the existing `Tooltip`
 * primitive already covers the one genuinely hard interaction piece).
 *
 * TITLE/COPY DISCIPLINE — CALLERS MUST LABEL THIS "Deposit Submissions",
 * NEVER "collected cash"/"validated deposits"/"settled cash"/"confirmed
 * cash movement": `points` includes pending, validated AND rejected
 * deposits, of both `rapped` and `grattage` types, summed together
 * (verified from `DashboardController::chartData()` — no status/type
 * filter exists). This component renders geometry and a tooltip; it does
 * not render a title itself (the caller, `TrendsPanel`, owns that copy).
 *
 * FINANCIAL DECIMAL SAFETY (mirrors ADR-0038's own boundary): `p.
 * totalAmount` is the model's AUTHORITATIVE, displayed value — rendered
 * VERBATIM in the tooltip and the `aria-label`, never reformatted. `Number
 * (p.totalAmount)` is called ONLY inside `barHeight`, purely to compute
 * SVG pixel geometry — that parsed number is used for NOTHING else, is
 * never stored, and never flows back into any displayed text.
 */
export type DepositSubmissionsChartProps = {
  points: DepositSubmissionPoint[];
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const BAR_GAP_RATIO = 0.25;
/** Direct hex, not `bg-primary` — this theme's `--primary` is still the
 * unthemed shadcn placeholder (near-black), not the frozen design
 * system's own Miza Teal (`#1F6F6B`, §4). Same restraint `StatusBadge`
 * already established for its six-tone system: a documented brand color
 * not yet wired into `index.css` is rendered via a direct Tailwind
 * arbitrary-value utility, not a new CSS custom property added as a side
 * effect of this one screen. */
const BAR_COLOR = "#1F6F6B";

/** Visualization-only geometry parse — see the module docblock. Never reused for display. */
function barHeight(totalAmount: string, max: number): number {
  if (max <= 0) return 0;
  const value = Number(totalAmount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return (value / max) * CHART_HEIGHT;
}

export function DepositSubmissionsChart({ points }: DepositSubmissionsChartProps) {
  const max = Math.max(0, ...points.map((p) => Number(p.totalAmount) || 0));
  const barWidth = (CHART_WIDTH / points.length) * (1 - BAR_GAP_RATIO);
  const step = CHART_WIDTH / points.length;

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Deposit Submissions, daily amount"
      >
        {points.map((point, index) => {
          const height = barHeight(point.totalAmount, max);
          const x = index * step + (step - barWidth) / 2;
          const y = CHART_HEIGHT - height;
          const label = `${formatDate(point.date)}: ${point.count} deposit${point.count === 1 ? "" : "s"}, ${point.totalAmount}`;

          return (
            <Tooltip key={point.date}>
              <TooltipTrigger asChild>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(barWidth, 0)}
                  height={Math.max(height, 0)}
                  fill={BAR_COLOR}
                  aria-label={label}
                  role="img"
                />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
      {first && last ? (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{formatDate(first.date)}</span>
          <span>{formatDate(last.date)}</span>
        </div>
      ) : null}
    </div>
  );
}
