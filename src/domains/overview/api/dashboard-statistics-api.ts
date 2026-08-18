import { httpClient } from "@/infrastructure/http";
import type {
  DashboardStatistics,
  SchedulerHealth,
  SchedulerHealthStatus,
} from "../model/dashboard-statistics";

/**
 * `GET /admin/dashboard/statistics` — `access-dashboard`, no pagination,
 * no envelope wrapper (unlike most read endpoints in this product, the
 * response body IS the object, no `{success, data}`/`{data, meta}`
 * wrapping — confirmed live, not assumed).
 *
 * ONLY THE NINE APPROVED FIELDS ARE DECLARED — every other field the real
 * backend response carries (`agents.total_active`/`total`,
 * `cities.breakdown`, `deposits.total_count`/`total_amount`/`cash_count`/
 * `bank_count`, the whole `debt` group) is simply absent from this type,
 * which is sufficient to keep it out of `DashboardStatistics` — there is
 * no runtime response-validation layer in this codebase for GET reads
 * (zod is used for form INPUT validation only), so omitting a field from
 * the wire type is itself the enforcement mechanism.
 */
type DashboardStatisticsEnvelope = {
  agents: {
    total_commercials: number;
    total_managers: number;
    blocked: number;
  };
  cities: {
    total_active_cities: number;
  };
  deposits: {
    recent_7days: number;
    this_month: number;
    last_month: number;
  };
  agents_finance: {
    total_solde: string | number;
    total_cash: string | number;
  };
  scheduler_health: {
    status: string;
    last_heartbeat_at: string | null;
    stale_after_seconds: number;
  };
};

const SCHEDULER_HEALTH_STATUSES: readonly string[] = [
  "healthy",
  "stale",
  "never_detected",
];

/**
 * Fails loud on an unrecognized `status`, mirroring
 * `normalizeAggregateDecimal`'s own precedent in this file — a wire value
 * outside the three the backend team's contract documents means the
 * contract changed underneath this mapper; silently passing an unknown
 * string through would let an un-mappable state reach the banner component,
 * which decides tone/copy by exhaustively matching these three literals.
 */
function toSchedulerHealthStatus(value: string): SchedulerHealthStatus {
  if (SCHEDULER_HEALTH_STATUSES.includes(value)) {
    return value as SchedulerHealthStatus;
  }

  throw new Error(`Unexpected scheduler_health.status: ${value}`);
}

function toSchedulerHealth(
  data: DashboardStatisticsEnvelope["scheduler_health"],
): SchedulerHealth {
  return {
    status: toSchedulerHealthStatus(data.status),
    lastHeartbeatAt: data.last_heartbeat_at,
    staleAfterSeconds: data.stale_after_seconds,
  };
}

/**
 * `total_solde`/`total_cash` are raw SQL `SUM()` aggregates — Laravel's
 * query-builder `sum()` does not cast its return value, and the pgsql PDO
 * driver returns a non-empty numeric aggregate as a STRING (verified live
 * against the running dev database: `"total_solde":"500.00"`). But
 * `sum()`'s own implementation is `return $result ?: 0;` — when the
 * aggregate matches ZERO rows, SQL `SUM()` returns `NULL`, `null` is
 * falsy, and the fallback yields a literal JSON INTEGER `0`, not `"0.00"`
 * (verified live: `"total_paid":0` — a sibling `sum()` field, same
 * codebath — on an empty table). This is a REPRESENTATION inconsistency
 * of the identical real zero value, not two different facts, so
 * normalizing it here performs no arithmetic and invents no business
 * value — it only makes the wire's own numeric-zero fallback match its
 * own string-decimal shape everywhere else this convention already holds.
 * A non-zero string is returned untouched, verbatim, NEVER routed through
 * `Number()`/`parseFloat()` or reconstructed.
 *
 * The ONLY verified numeric case is exactly `0` (the SQL `SUM()` NULL
 * fallback) — never an arbitrary non-zero number. An unexpected non-zero
 * number would mean this wire contract changed underneath this mapper;
 * failing loud here (surfacing as the Statistics panel's own retryable
 * error state) is correct — silently formatting a number this contract
 * was never verified to send would be exactly the invented-normalization
 * this decision explicitly forbids.
 */
function normalizeAggregateDecimal(value: string | number): string {
  if (typeof value === "string") return value;
  if (value !== 0) {
    throw new Error(`Unexpected non-zero numeric dashboard aggregate: ${value}`);
  }
  return "0.00";
}

function toDashboardStatistics(data: DashboardStatisticsEnvelope): DashboardStatistics {
  return {
    networkHealth: {
      activeCommercials: data.agents.total_commercials,
      activeManagers: data.agents.total_managers,
      blockedAgents: data.agents.blocked,
      activeCities: data.cities.total_active_cities,
    },
    cashMovement: {
      depositsLast7Days: data.deposits.recent_7days,
      depositsThisMonth: data.deposits.this_month,
      depositsLastMonth: data.deposits.last_month,
    },
    exposure: {
      totalSolde: normalizeAggregateDecimal(data.agents_finance.total_solde),
      totalCash: normalizeAggregateDecimal(data.agents_finance.total_cash),
    },
    schedulerHealth: toSchedulerHealth(data.scheduler_health),
  };
}

export async function fetchDashboardStatistics(): Promise<DashboardStatistics> {
  const { data } = await httpClient.get<DashboardStatisticsEnvelope>(
    "/admin/dashboard/statistics",
  );
  return toDashboardStatistics(data);
}
