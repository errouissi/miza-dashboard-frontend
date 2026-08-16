import type { ReactNode } from "react";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { StatCard } from "@/shared/components/business/stat-card";
import { useDashboardStatisticsQuery } from "../queries/dashboard-statistics-queries";

/**
 * M7 Overview Phase 2 — Statistics. Nine headline KPI tiles from ONE
 * `GET /admin/dashboard/statistics` read, grouped into the three sections
 * the frozen Overview purpose names: Network health, Cash movement,
 * Exposure. See `model/dashboard-statistics.ts`'s own docblock for the
 * full field-selection rationale and exclusion list.
 *
 * SPLIT INTO AN OUTER GATE + AN INNER CONTENT COMPONENT — identical
 * reasoning to every Phase 1 widget's own docblock:
 * `useDashboardStatisticsQuery` has no route guard to sit inside (Overview
 * composes this panel directly at `/`), so the permission check
 * conditionally MOUNTS `StatisticsContent` rather than gating after the
 * hook already ran. `ACCESS_DASHBOARD` absent -> this component renders
 * nothing, and the query never mounts -> zero `/dashboard/statistics`
 * requests, pinned by test.
 *
 * NO INNER "Statistics" HEADING — `OverviewPage` owns that as a
 * page-level section label (the same static, permission-blind structural
 * text its own "Overview" `<h1>` already is), so this component starts
 * directly with its grouped card content, keeping the card's own visual
 * language identical to Phase 1's widgets (`rounded-lg border p-4`).
 */
export function StatisticsPanel() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);

  if (!canView) return null;

  return <StatisticsContent />;
}

function StatGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function StatisticsLoadingState() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-busy="true"
      data-testid="statistics-loading"
    >
      {Array.from({ length: 9 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}

function StatisticsContent() {
  const query = useDashboardStatisticsQuery();

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Statistics could not be loaded.")
    : "Statistics could not be loaded.";

  return (
    <div className="rounded-lg border p-4">
      {query.isPending ? (
        <StatisticsLoadingState />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <StatGroup title="Network health">
            <StatCard
              label="Active Commercials"
              value={query.data.networkHealth.activeCommercials}
            />
            <StatCard
              label="Active Managers"
              value={query.data.networkHealth.activeManagers}
            />
            <StatCard
              label="Blocked Agents"
              value={query.data.networkHealth.blockedAgents}
            />
            <StatCard
              label="Active Cities"
              value={query.data.networkHealth.activeCities}
            />
          </StatGroup>

          <StatGroup title="Cash movement">
            <StatCard
              label="Deposits — Last 7 Days"
              value={query.data.cashMovement.depositsLast7Days}
            />
            <StatCard
              label="Deposits — This Month"
              value={query.data.cashMovement.depositsThisMonth}
            />
            <StatCard
              label="Deposits — Last Month"
              value={query.data.cashMovement.depositsLastMonth}
            />
          </StatGroup>

          <StatGroup title="Exposure">
            <StatCard label="Total Solde" value={query.data.exposure.totalSolde} />
            <StatCard label="Total Cash" value={query.data.exposure.totalCash} />
          </StatGroup>
        </div>
      )}
    </div>
  );
}
