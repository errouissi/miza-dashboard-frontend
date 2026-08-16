/**
 * M7 Overview Phase 2 — Statistics. `GET /admin/dashboard/statistics`
 * (`DashboardController::index()`), gated on `access-dashboard` alone —
 * verified fresh from source and re-verified live against the running dev
 * backend this phase (`routes/api.php:162`).
 *
 * THE BACKEND RETURNS FAR MORE THAN THIS MODEL KEEPS — `agents.total`/
 * `agents.total_active`, `cities.breakdown`, `deposits.total_count`/
 * `total_amount`/`cash_count`/`bank_count`, the entire `debt` group, are
 * all present on the wire and deliberately NOT modeled here (ADR-0008 —
 * map only consumed fields). This is an explicit, reviewed exclusion list
 * (see the M7 Overview Phase 2 discovery/approval), not an oversight:
 * `agents.total_active` duplicates `total_commercials + total_managers`
 * (both already shown), `debt.*` is an internal admin-accounting figure
 * with no network/cash/stock meaning, and the rest were judged redundant
 * or out of Phase 2's own scope (`cities.breakdown` is a Phase 4 concern —
 * see `next-session.md`'s own "do not duplicate city-breakdown data"
 * rule). Grouped into exactly the three sections the frozen Overview
 * purpose names (network health / cash movement / exposure) — this
 * grouping IS the model, not a presentation-only relabeling of a flatter
 * shape, since Statistics has exactly one real caller and that caller
 * renders these three groups directly.
 */
export type DashboardStatisticsNetworkHealth = {
  activeCommercials: number;
  activeManagers: number;
  blockedAgents: number;
  activeCities: number;
};

export type DashboardStatisticsCashMovement = {
  depositsLast7Days: number;
  depositsThisMonth: number;
  depositsLastMonth: number;
};

/**
 * `totalSolde`/`totalCash` are raw SQL `SUM()` aggregates over
 * `decimal:2` columns (`Agent.solde`/`Agent.cash`), NOT per-row
 * Eloquent-cast attributes — Laravel's query-builder `sum()` never casts
 * its raw driver return value. Modeled as a STRING, matching this
 * codebase's existing "backend-computed decimal → string → render
 * verbatim, never through `MoneyAmount`/`formatMoney`" convention
 * (Cheques' `amount`, Grattage's `totalAmount`, Managers'/Commercials'
 * `avanceTotal`) — see `dashboard-statistics-api.ts`'s own
 * `normalizeAggregateDecimal` docblock for the ONE representational
 * inconsistency (a SQL `SUM()` over zero rows) this mapper corrects, and
 * why that is not financial arithmetic.
 */
export type DashboardStatisticsExposure = {
  totalSolde: string;
  totalCash: string;
};

export type DashboardStatistics = {
  networkHealth: DashboardStatisticsNetworkHealth;
  cashMovement: DashboardStatisticsCashMovement;
  exposure: DashboardStatisticsExposure;
};
