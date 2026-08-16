import { formatDate } from "@/shared/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { AgentRegistrationPoint } from "../model/dashboard-chart-data";

/**
 * M7 Overview Phase 3 — a small, purpose-built SVG grouped-bar chart for
 * "Agent Registrations" — the SECOND of exactly two chart callers this
 * phase adds. See `deposit-submissions-chart.tsx`'s own docblock for why
 * this stays a small, explicit, domain-local component rather than a
 * generic charting primitive or a new dependency.
 *
 * `points` is pre-grouped date-major, role-minor by
 * `dashboard-chart-data-api.ts`'s own `toAgentRegistrationsSeries` — every
 * date carries exactly `roles.length` consecutive entries in the SAME
 * role order, so this component simply chunks by `roles.length` rather
 * than re-deriving the grouping itself.
 *
 * ROLE LABELS/COLORS ARE DERIVED FROM WHATEVER ROLES ARE OBSERVED, NEVER
 * A HARDCODED SET — `roles` comes from the model's own `Array.from(new
 * Set(...))`, never assumed to be exactly `["manager", "commercial"]`.
 * `ROLE_LABELS` supplies a friendly label for the two roles this product
 * has ever used elsewhere (verified: every other Agent-related screen in
 * this codebase only ever branches on `manager`/`commercial`); an
 * observed role outside that set still renders, capitalized verbatim,
 * with a fallback muted color — never dropped, never a crash.
 */
export type AgentRegistrationsChartProps = {
  points: AgentRegistrationPoint[];
  roles: string[];
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const GROUP_GAP_RATIO = 0.3;
const BAR_GAP_RATIO = 0.15;

/** Same direct-hex discipline as `deposit-submissions-chart.tsx` — the
 * frozen design system's own Primary Teal / Secondary Plum (§4: "the
 * secondary exists only for data-visualization series"), not this
 * theme's still-unthemed `--primary`/`--secondary`. */
const ROLE_COLORS = ["#1F6F6B", "#7A4F9E"];
const FALLBACK_COLOR = "#8A939B";

const ROLE_LABELS: Record<string, string> = {
  manager: "Managers",
  commercial: "Commercials",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function roleColor(index: number): string {
  return ROLE_COLORS[index] ?? FALLBACK_COLOR;
}

function chunkByDate(
  points: AgentRegistrationPoint[],
  roleCount: number,
): AgentRegistrationPoint[][] {
  if (roleCount === 0) return [];
  const groups: AgentRegistrationPoint[][] = [];
  for (let i = 0; i < points.length; i += roleCount) {
    groups.push(points.slice(i, i + roleCount));
  }
  return groups;
}

export function AgentRegistrationsChart({ points, roles }: AgentRegistrationsChartProps) {
  const groups = chunkByDate(points, roles.length);
  const max = Math.max(0, ...points.map((p) => p.count));
  const groupStep = CHART_WIDTH / Math.max(groups.length, 1);
  const groupWidth = groupStep * (1 - GROUP_GAP_RATIO);
  const barWidth = (groupWidth / Math.max(roles.length, 1)) * (1 - BAR_GAP_RATIO);

  const first = groups[0]?.[0];
  const last = groups[groups.length - 1]?.[0];

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Agent Registrations, daily count by role"
      >
        {groups.map((group, groupIndex) => {
          const groupX = groupIndex * groupStep + (groupStep - groupWidth) / 2;

          return group.map((point, roleIndex) => {
            const barHeight = max > 0 ? (point.count / max) * CHART_HEIGHT : 0;
            const x = groupX + roleIndex * (groupWidth / roles.length);
            const y = CHART_HEIGHT - barHeight;
            const label = `${formatDate(point.date)}: ${point.count} ${roleLabel(point.role)}`;

            return (
              <Tooltip key={`${point.date}-${point.role}`}>
                <TooltipTrigger asChild>
                  <rect
                    x={x}
                    y={y}
                    width={Math.max(barWidth, 0)}
                    height={Math.max(barHeight, 0)}
                    fill={roleColor(roleIndex)}
                    aria-label={label}
                    role="img"
                  />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          });
        })}
      </svg>

      {first && last ? (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{formatDate(first.date)}</span>
          <span>{formatDate(last.date)}</span>
        </div>
      ) : null}

      {/* A legend is needed here, unlike Deposit Submissions' single
          series, because multiple role series require identification
          (decision #10). */}
      <div className="flex items-center gap-4 text-xs">
        {roles.map((role, index) => (
          <span key={role} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: roleColor(index) }}
              aria-hidden="true"
            />
            {roleLabel(role)}
          </span>
        ))}
      </div>
    </div>
  );
}
