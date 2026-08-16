/**
 * The Dashboard Statistics query-key factory (FTA §8). FLAT, no
 * parameters — `GET /admin/dashboard/statistics` reads one global,
 * unscoped aggregate (no agent id, no filters), unlike every other
 * `detail(id)`-shaped factory in this codebase.
 */
export const dashboardStatisticsKeys = {
  all: ["dashboard-statistics"] as const,
};

/**
 * The Dashboard Chart Data query-key factory (M7 Overview Phase 3).
 * PARAMETERIZED BY `days`, unlike `dashboardStatisticsKeys` above — a
 * different `days` value is a genuinely different cache entry (the
 * backend's own window changes), not a re-filter of the same data.
 */
export const dashboardChartDataKeys = {
  detail: (days: number) => ["dashboard-chart-data", days] as const,
};
