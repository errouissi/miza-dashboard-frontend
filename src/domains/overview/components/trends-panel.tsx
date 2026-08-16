import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListEmptyState, ListErrorState } from "@/shared/components/patterns/list-states";
import { useDashboardChartDataQuery } from "../queries/dashboard-chart-data-queries";
import { DepositSubmissionsChart } from "./deposit-submissions-chart";
import { AgentRegistrationsChart } from "./agent-registrations-chart";

const DAYS = 30;

/**
 * M7 Overview Phase 3 — Trends. Two charts from ONE
 * `GET /admin/dashboard/chart-data?days=30` read, gated on
 * `ACCESS_DASHBOARD` (verified the exact backend permission — identical
 * to Statistics'/the Overdue Grattage widget's own gate, not assumed).
 *
 * SPLIT INTO AN OUTER GATE + AN INNER CONTENT COMPONENT — identical
 * reasoning to `StatisticsPanel`'s own docblock: `useDashboardChartDataQuery`
 * has no route guard to sit inside, so the permission check conditionally
 * MOUNTS `TrendsContent` rather than gating after the hook already ran.
 *
 * NO INNER "Trends" HEADING — `OverviewPage` owns that as a page-level
 * section label, the same convention `StatisticsPanel` already
 * established for "Statistics".
 */
export function TrendsPanel() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);

  if (!canView) return null;

  return <TrendsContent />;
}

function TrendsLoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" data-testid="trends-loading">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function TrendsContent() {
  const query = useDashboardChartDataQuery(DAYS);

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Trends could not be loaded.")
    : "Trends could not be loaded.";

  return (
    <div className="rounded-lg border p-4">
      {query.isPending ? (
        <TrendsLoadingState />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Deposit Submissions — Last 30 Days</h3>
            {query.data.depositSubmissions.hasData ? (
              <DepositSubmissionsChart points={query.data.depositSubmissions.points} />
            ) : (
              <ListEmptyState>No deposits in the selected period.</ListEmptyState>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Agent Registrations — Last 30 Days</h3>
            {query.data.agentRegistrations.hasData ? (
              <AgentRegistrationsChart
                points={query.data.agentRegistrations.points}
                roles={query.data.agentRegistrations.roles}
              />
            ) : (
              <ListEmptyState>
                No agent registrations in the selected period.
              </ListEmptyState>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
