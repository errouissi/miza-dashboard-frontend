/**
 * The Dashboard Statistics query-key factory (FTA §8). FLAT, no
 * parameters — `GET /admin/dashboard/statistics` reads one global,
 * unscoped aggregate (no agent id, no filters), unlike every other
 * `detail(id)`-shaped factory in this codebase.
 */
export const dashboardStatisticsKeys = {
  all: ["dashboard-statistics"] as const,
};
