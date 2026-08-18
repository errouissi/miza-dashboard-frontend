/**
 * The Stock Overview query-key factory (FTA §8). FLAT, no parameters —
 * `GET /admin/stock` reads one global, unscoped network aggregate (no id,
 * no filters accepted by the endpoint itself), the same shape
 * `dashboardStatisticsKeys` already established for an equivalent
 * single-aggregate read.
 */
export const stockOverviewKeys = {
  all: ["stock-overview"] as const,
};
