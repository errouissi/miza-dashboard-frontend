import { formatDateTime } from "@/shared/formatters";
import { cn } from "@/shared/lib/utils";
import { usePermission } from "@/shared/hooks";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { useDashboardStatisticsQuery } from "../queries/dashboard-statistics-queries";
import type { SchedulerHealthStatus } from "../model/dashboard-statistics";

/**
 * Scheduler Health warning (pre-M8 operational hardening) — a page banner
 * (Design System §20: "Application-scope conditions spanning all modules...
 * full-width under the header, one at a time") for the ONE real condition
 * this codebase currently has of that kind. First real caller of the
 * pattern — kept domain-local, not extracted to `shared/`, per this
 * project's own Rule-of-Three discipline (ADR-0006/CLAUDE.md): a second,
 * unrelated application-scope banner need is the evidence to revisit that,
 * not this single caller.
 *
 * REUSES THE EXISTING `useDashboardStatisticsQuery` UNCHANGED — no new
 * query, no new endpoint, no `refetchInterval`/polling added (explicit
 * scope decision: this field rides the Statistics panel's own existing
 * `SLOW` (5 min) freshness, exactly like the other nine KPI fields already
 * on that read). `StatisticsPanel` already gates this same query on
 * `ACCESS_DASHBOARD`; this component gates itself identically and
 * independently, since it mounts as a sibling, not a child, of that panel.
 *
 * STATUS IS RENDERED VERBATIM FROM THE BACKEND, NEVER COMPUTED HERE — no
 * date-vs-now comparison exists anywhere in this component. The backend
 * team's own contract (`docs/api-endpoints.md`, backend repo) is
 * authoritative for what `healthy`/`stale`/`never_detected` means.
 *
 * `healthy` renders NOTHING — no persistent "all clear" chip either;
 * nothing in the frozen design spec or this codebase calls for one, and
 * §20 itself: "a product with permanent banners has moved its problems
 * into the chrome instead of fixing them."
 *
 * TONE mirrors `StatusBadge`'s own six-tone vocabulary (Design System §4) —
 * `stale` -> warning (amber, "attention without failure"), `never_detected`
 * -> danger (red, a scheduler that has never once ticked is a harder signal
 * than one that ran before and lagged). No icon: this codebase's own
 * existing semantic-color precedents (`StatusBadge`'s dot, `ListErrorState`'s
 * plain text) don't use decorative icons either, and text + color already
 * carries the distinction without a new lucide-react caller in this domain.
 */

const COPY: Record<
  Exclude<SchedulerHealthStatus, "healthy">,
  { title: string; toneClass: string }
> = {
  stale: {
    title: "Background scheduler not detected recently.",
    toneClass: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-400",
  },
  never_detected: {
    title: "Background scheduler has not been detected.",
    toneClass: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  },
};

export function SchedulerHealthBanner() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);

  if (!canView) return null;

  return <SchedulerHealthBannerContent />;
}

function SchedulerHealthBannerContent() {
  const statisticsQuery = useDashboardStatisticsQuery();
  const schedulerHealth = statisticsQuery.data?.schedulerHealth;

  // Loading/error states are already owned by StatisticsPanel, which reads
  // the SAME query (identical queryKey, shared cache entry) — this banner
  // simply has nothing to show yet/on failure, rather than duplicating a
  // second loading skeleton or error callout for one field of a read
  // another panel already surfaces in full.
  if (!schedulerHealth || schedulerHealth.status === "healthy") return null;

  const { title, toneClass } = COPY[schedulerHealth.status];

  return (
    <div
      role="alert"
      className={cn("rounded-md border-l-4 px-4 py-3 text-sm", toneClass)}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1">
        Scheduled automation (e.g. Grattage overdue processing) may{" "}
        {schedulerHealth.status === "never_detected" ? "not be running" : "be delayed"}.
      </p>
      {schedulerHealth.status === "stale" && schedulerHealth.lastHeartbeatAt ? (
        <p className="text-muted-foreground mt-1">
          Last detected: {formatDateTime(schedulerHealth.lastHeartbeatAt)}
        </p>
      ) : null}
    </div>
  );
}
