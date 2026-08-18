import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchDashboardStatistics } from "./dashboard-statistics-api";

const API = "http://localhost/api/v1";

/**
 * A plain, no-React unit test of the mapper — mirrors
 * `grattage-outstanding-api.test.ts`'s own convention (a direct
 * `fetch*` call against the shared MSW `server`, no DOM in between).
 *
 * `DashboardController::index()`'s own response shape, verified fresh
 * from source AND live against the running dev database this phase — no
 * `{success, data}`/`{data, meta}` envelope, unlike most read endpoints
 * in this product.
 */
function statisticsEnvelope(
  overrides: Partial<{
    agents: { total_commercials: number; total_managers: number; blocked: number };
    cities: { total_active_cities: number };
    deposits: { recent_7days: number; this_month: number; last_month: number };
    agents_finance: { total_solde: string | number; total_cash: string | number };
    scheduler_health: {
      status: string;
      last_heartbeat_at: string | null;
      stale_after_seconds: number;
    };
  }> = {},
) {
  return {
    agents: {
      total_commercials: 12,
      total_managers: 4,
      total_active: 16,
      blocked: 2,
      total: 18,
      ...overrides.agents,
    },
    cities: {
      total_active_cities: 5,
      breakdown: [{ ville_actuelle: "marrakech", agent_count: 3 }],
      ...overrides.cities,
    },
    deposits: {
      total_count: 40,
      total_amount: "12000.00",
      cash_count: 10,
      bank_count: 30,
      recent_7days: 7,
      this_month: 20,
      last_month: 15,
      ...overrides.deposits,
    },
    debt: {
      total_admin_debt: "0.00",
      admins_with_debt: 0,
      total_paid: 0,
    },
    agents_finance: {
      total_solde: "500.00",
      total_cash: "0.00",
      ...overrides.agents_finance,
    },
    scheduler_health: {
      status: "healthy",
      last_heartbeat_at: "2026-08-18 17:41:00",
      stale_after_seconds: 300,
      ...overrides.scheduler_health,
    },
  };
}

function statisticsHandler(envelope: ReturnType<typeof statisticsEnvelope>) {
  return http.get(`${API}/admin/dashboard/statistics`, () => HttpResponse.json(envelope));
}

describe("fetchDashboardStatistics", () => {
  it("maps exactly the nine approved fields, grouped Network health / Cash movement / Exposure, plus scheduler_health", async () => {
    server.use(statisticsHandler(statisticsEnvelope()));

    const result = await fetchDashboardStatistics();

    expect(result).toEqual({
      networkHealth: {
        activeCommercials: 12,
        activeManagers: 4,
        blockedAgents: 2,
        activeCities: 5,
      },
      cashMovement: {
        depositsLast7Days: 7,
        depositsThisMonth: 20,
        depositsLastMonth: 15,
      },
      exposure: {
        totalSolde: "500.00",
        totalCash: "0.00",
      },
      schedulerHealth: {
        status: "healthy",
        lastHeartbeatAt: "2026-08-18 17:41:00",
        staleAfterSeconds: 300,
      },
    });
  });

  it("preserves a non-zero decimal string exactly, never routed through a number", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({
          agents_finance: { total_solde: "128450.75", total_cash: "3200.10" },
        }),
      ),
    );

    const result = await fetchDashboardStatistics();

    expect(result.exposure.totalSolde).toBe("128450.75");
    expect(result.exposure.totalCash).toBe("3200.10");
    expect(typeof result.exposure.totalSolde).toBe("string");
  });

  it('normalizes the SQL SUM() NULL->0 fallback (a bare numeric 0) to "0.00"', async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({ agents_finance: { total_solde: 0, total_cash: 0 } }),
      ),
    );

    const result = await fetchDashboardStatistics();

    expect(result.exposure.totalSolde).toBe("0.00");
    expect(result.exposure.totalCash).toBe("0.00");
  });

  it("throws on an unexpected non-zero numeric aggregate rather than silently formatting it", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({ agents_finance: { total_solde: 500, total_cash: "0.00" } }),
      ),
    );

    await expect(fetchDashboardStatistics()).rejects.toThrow(/non-zero/i);
  });

  it("does not leak excluded fields into the mapped model", async () => {
    server.use(statisticsHandler(statisticsEnvelope()));

    const result = await fetchDashboardStatistics();

    expect(Object.keys(result)).toEqual([
      "networkHealth",
      "cashMovement",
      "exposure",
      "schedulerHealth",
    ]);
    expect(Object.keys(result.networkHealth)).toEqual([
      "activeCommercials",
      "activeManagers",
      "blockedAgents",
      "activeCities",
    ]);
    expect(Object.keys(result.cashMovement)).toEqual([
      "depositsLast7Days",
      "depositsThisMonth",
      "depositsLastMonth",
    ]);
    expect(Object.keys(result.exposure)).toEqual(["totalSolde", "totalCash"]);
    expect(result).not.toHaveProperty("debt");
    expect(result).not.toHaveProperty("cities.breakdown");
  });

  it("requests the exact endpoint, no query params, no envelope unwrapping", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/dashboard/statistics`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(statisticsEnvelope());
      }),
    );

    await fetchDashboardStatistics();

    expect(url?.pathname).toBe("/api/v1/admin/dashboard/statistics");
    expect(url?.search).toBe("");
  });
});

/**
 * Scheduler Health (pre-M8 operational hardening, additive) — backend
 * contract confirmed live against the Backend Team's own pushed
 * implementation (`92d75cf`): `status` is one of exactly three literals,
 * backend-computed; `last_heartbeat_at` is a plain `"Y-m-d H:i:s"` local
 * string (Africa/Casablanca), NOT ISO-8601 — never reformatted or
 * re-parsed here, carried verbatim like every other backend-computed
 * string this mapper already handles.
 */
describe("fetchDashboardStatistics — scheduler_health", () => {
  it("maps a healthy heartbeat verbatim", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({
          scheduler_health: {
            status: "healthy",
            last_heartbeat_at: "2026-08-18 17:41:00",
            stale_after_seconds: 300,
          },
        }),
      ),
    );

    const result = await fetchDashboardStatistics();

    expect(result.schedulerHealth).toEqual({
      status: "healthy",
      lastHeartbeatAt: "2026-08-18 17:41:00",
      staleAfterSeconds: 300,
    });
  });

  it("maps a stale heartbeat verbatim", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({
          scheduler_health: {
            status: "stale",
            last_heartbeat_at: "2026-08-18 12:00:00",
            stale_after_seconds: 300,
          },
        }),
      ),
    );

    const result = await fetchDashboardStatistics();

    expect(result.schedulerHealth.status).toBe("stale");
    expect(result.schedulerHealth.lastHeartbeatAt).toBe("2026-08-18 12:00:00");
  });

  it("maps never_detected with a null last_heartbeat_at, never fabricating a timestamp", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({
          scheduler_health: {
            status: "never_detected",
            last_heartbeat_at: null,
            stale_after_seconds: 300,
          },
        }),
      ),
    );

    const result = await fetchDashboardStatistics();

    expect(result.schedulerHealth.status).toBe("never_detected");
    expect(result.schedulerHealth.lastHeartbeatAt).toBeNull();
  });

  it("throws on an unrecognized status rather than silently passing it through", async () => {
    server.use(
      statisticsHandler(
        statisticsEnvelope({
          scheduler_health: {
            status: "unknown_future_status",
            last_heartbeat_at: null,
            stale_after_seconds: 300,
          },
        }),
      ),
    );

    await expect(fetchDashboardStatistics()).rejects.toThrow(/scheduler_health\.status/i);
  });
});
