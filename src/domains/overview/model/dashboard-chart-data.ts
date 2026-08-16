/**
 * M7 Overview Phase 3 — Trends. `GET /admin/dashboard/chart-data?days=N`
 * (`DashboardController::chartData()`), gated on `access-dashboard` alone
 * — verified fresh from source and re-verified live against the running
 * dev backend this phase.
 *
 * ONLY TWO OF THE FOUR SERIES THE ENDPOINT RETURNS ARE MODELED —
 * `deposits_by_method` and `agents_by_city` are deliberately excluded, by
 * explicit product decision, not by oversight: `agents_by_city` is a
 * byte-for-byte duplicate of `statistics.cities.breakdown` (already
 * excluded from Phase 2 for the identical reason — rendering it here
 * would be the exact redundant second city-data visualization that
 * exclusion exists to prevent); `deposits_by_method` is an all-time
 * method breakdown, not a trend, and does not belong in this chart phase.
 * See the M7 Overview Phase 3 discovery report for the full analysis.
 *
 * `depositSubmissions` — DELIBERATELY NAMED AND LABELED FOR WHAT THE WIRE
 * CONTRACT ACTUALLY IS, NOT WHAT IT MIGHT BE MISTAKEN FOR: verified fresh
 * from `DashboardController::chartData()` that the underlying query
 * (`Deposit::where('created_at', ...)`) carries NO `status` filter and NO
 * `type` filter — pending, validated AND rejected deposits, of BOTH
 * `rapped` and `grattage` types, are all summed together. This is
 * submission ACTIVITY, not confirmed/collected cash. Any UI surface
 * consuming this model MUST NOT label it "collected cash", "validated
 * deposits", "settled cash", or "confirmed cash movement" — see
 * `components/deposit-submissions-chart.tsx`'s own docblock for the
 * approved copy ("Deposit Submissions").
 *
 * ZERO-FILLED FOR CHART CONTINUITY, NOT A BACKEND FACT — the backend
 * OMITS a day/role-with-zero-rows entirely (verified live: a day with no
 * deposits produces no array entry at all). `isZeroFilled` distinguishes
 * a REAL backend row (`false`) from a client-GENERATED continuity point
 * (`true`) — no backend record is fabricated; only a visualization
 * placeholder is inserted so a partially-populated series renders as a
 * continuous day-by-day chart instead of a sparse, gap-toothed one. See
 * `api/dashboard-chart-data-api.ts`'s own docblock for exactly how this
 * is computed.
 */
export type DepositSubmissionPoint = {
  /** `YYYY-MM-DD`. */
  date: string;
  count: number;
  /**
   * The backend's own verbatim decimal string for a REAL row (e.g.
   * `"20.00"`); the literal string `"0.00"` for a client-generated
   * zero-fill day — NEVER a JS number, NEVER reformatted. Render as-is;
   * numeric parsing is permitted ONLY inside a chart's own geometry
   * calculation, never here and never reassigned back onto this field.
   */
  totalAmount: string;
  /** `true` for a client-generated continuity point; `false` for a real backend row. */
  isZeroFilled: boolean;
};

export type AgentRegistrationPoint = {
  /** `YYYY-MM-DD`. */
  date: string;
  /**
   * Copied verbatim from the backend — NOT narrowed to a literal union.
   * `chartData()`'s own query has no role filter, so any value the
   * `agents.role` column holds could in principle appear; the UI maps
   * only the roles it OBSERVES in a given response (see `roles` below),
   * never a hardcoded, invented set.
   */
  role: string;
  count: number;
  /** `true` for a client-generated (date, role) continuity point; `false` for a real backend row. */
  isZeroFilled: boolean;
};

export type DepositSubmissionsSeries = {
  /** Zero-filled, continuous, ascending date order — see the module docblock. */
  points: DepositSubmissionPoint[];
  /** `true` iff the backend returned at least one real `deposits_over_time` row. */
  hasData: boolean;
};

export type AgentRegistrationsSeries = {
  /** Zero-filled per OBSERVED role only, ascending date order. */
  points: AgentRegistrationPoint[];
  /** Distinct roles present anywhere in the real backend response, sorted. Never invented. */
  roles: string[];
  /** `true` iff the backend returned at least one real `agent_registrations` row. */
  hasData: boolean;
};

export type DashboardChartData = {
  depositSubmissions: DepositSubmissionsSeries;
  agentRegistrations: AgentRegistrationsSeries;
};
