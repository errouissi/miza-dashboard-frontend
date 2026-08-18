import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import {
  createQueryClient,
  invalidateForEvent,
  STALE_TIMES,
} from "@/infrastructure/query";
import { useDashboardStatisticsQuery } from "./dashboard-statistics-queries";
import { dashboardStatisticsKeys } from "./keys";

const API = "http://localhost/api/v1";

/**
 * `renderHook` + a real `QueryClientProvider`, mirroring
 * `grattage-outstanding-queries.test.tsx`'s own established pattern for a
 * standalone query-hook test (no page renders this hook in isolation from
 * `StatisticsPanel`, so this file exercises it directly).
 */
function statisticsEnvelope() {
  return {
    agents: {
      total_commercials: 12,
      total_managers: 4,
      blocked: 2,
      total_active: 16,
      total: 18,
    },
    cities: { total_active_cities: 5, breakdown: [] },
    deposits: {
      total_count: 40,
      total_amount: "12000.00",
      cash_count: 10,
      bank_count: 30,
      recent_7days: 7,
      this_month: 20,
      last_month: 15,
    },
    debt: { total_admin_debt: "0.00", admins_with_debt: 0, total_paid: 0 },
    agents_finance: { total_solde: "500.00", total_cash: "0.00" },
    scheduler_health: {
      status: "healthy",
      last_heartbeat_at: "2026-08-18 17:41:00",
      stale_after_seconds: 300,
    },
  };
}

function wrapper(queryClient = createQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useDashboardStatisticsQuery", () => {
  it("uses the dashboard-statistics key and resolves the mapped model", async () => {
    server.use(
      http.get(`${API}/admin/dashboard/statistics`, () =>
        HttpResponse.json(statisticsEnvelope()),
      ),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardStatisticsQuery(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.exposure.totalSolde).toBe("500.00");
    expect(
      queryClient.getQueryCache().find({ queryKey: dashboardStatisticsKeys.all }),
    ).toBeDefined();
  });

  it("uses the SLOW stale time (5 minutes)", async () => {
    server.use(
      http.get(`${API}/admin/dashboard/statistics`, () =>
        HttpResponse.json(statisticsEnvelope()),
      ),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardStatisticsQuery(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient
      .getQueryCache()
      .find({ queryKey: dashboardStatisticsKeys.all });
    const options = cached?.options as { staleTime?: number } | undefined;
    expect(options?.staleTime).toBe(STALE_TIMES.SLOW);
  });

  it("does not fetch while disabled", async () => {
    let called = false;
    server.use(
      http.get(`${API}/admin/dashboard/statistics`, () => {
        called = true;
        return HttpResponse.json(statisticsEnvelope());
      }),
    );

    renderHook(() => useDashboardStatisticsQuery({ enabled: false }), {
      wrapper: wrapper(),
    });

    // A disabled query never transitions out of "pending" — a short settle
    // is enough to prove no request fired.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(called).toBe(false);
  });

  it("no registered domain event invalidates dashboard-statistics (no speculative invalidation)", async () => {
    let requestCount = 0;
    server.use(
      http.get(`${API}/admin/dashboard/statistics`, () => {
        requestCount += 1;
        return HttpResponse.json(statisticsEnvelope());
      }),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardStatisticsQuery(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestCount).toBe(1);

    // A representative sample of events already registered elsewhere in
    // `invalidation-map.ts` — none of them names `["dashboard-statistics"]`
    // as a target prefix, and this query has no mutation of its own to
    // register one. If dashboard-statistics were ever wired in by mistake,
    // one of these would trigger a refetch.
    await invalidateForEvent(queryClient, "cheque.approved");
    await invalidateForEvent(queryClient, "deposit.validated");
    await invalidateForEvent(queryClient, "grattage-invoice.cancelled");
    await invalidateForEvent(queryClient, "agent.updated");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestCount).toBe(1);
  });
});
