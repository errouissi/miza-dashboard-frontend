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
import { useDashboardChartDataQuery } from "./dashboard-chart-data-queries";
import { dashboardChartDataKeys } from "./keys";

const API = "http://localhost/api/v1";

function chartDataEnvelope() {
  return {
    deposits_over_time: [],
    deposits_by_method: [],
    agents_by_city: [],
    agent_registrations: [],
  };
}

function wrapper(queryClient = createQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useDashboardChartDataQuery", () => {
  it("keys by days — a different days value is a different cache entry", async () => {
    server.use(
      http.get(`${API}/admin/dashboard/chart-data`, () =>
        HttpResponse.json(chartDataEnvelope()),
      ),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardChartDataQuery(30), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryCache().find({ queryKey: dashboardChartDataKeys.detail(30) }),
    ).toBeDefined();
    expect(
      queryClient.getQueryCache().find({ queryKey: dashboardChartDataKeys.detail(7) }),
    ).toBeUndefined();
  });

  it("requests with the exact days query param", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/dashboard/chart-data`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(chartDataEnvelope());
      }),
    );

    renderHook(() => useDashboardChartDataQuery(14), { wrapper: wrapper() });

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("days")).toBe("14");
  });

  it("uses the SLOW stale time (5 minutes)", async () => {
    server.use(
      http.get(`${API}/admin/dashboard/chart-data`, () =>
        HttpResponse.json(chartDataEnvelope()),
      ),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardChartDataQuery(30), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient
      .getQueryCache()
      .find({ queryKey: dashboardChartDataKeys.detail(30) });
    const options = cached?.options as { staleTime?: number } | undefined;
    expect(options?.staleTime).toBe(STALE_TIMES.SLOW);
  });

  it("does not fetch while disabled", async () => {
    let called = false;
    server.use(
      http.get(`${API}/admin/dashboard/chart-data`, () => {
        called = true;
        return HttpResponse.json(chartDataEnvelope());
      }),
    );

    renderHook(() => useDashboardChartDataQuery(30, { enabled: false }), {
      wrapper: wrapper(),
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(called).toBe(false);
  });

  it("no registered domain event invalidates dashboard-chart-data (no speculative invalidation)", async () => {
    let requestCount = 0;
    server.use(
      http.get(`${API}/admin/dashboard/chart-data`, () => {
        requestCount += 1;
        return HttpResponse.json(chartDataEnvelope());
      }),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDashboardChartDataQuery(30), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestCount).toBe(1);

    await invalidateForEvent(queryClient, "cheque.approved");
    await invalidateForEvent(queryClient, "deposit.validated");
    await invalidateForEvent(queryClient, "grattage-invoice.cancelled");
    await invalidateForEvent(queryClient, "agent.updated");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestCount).toBe(1);
  });
});
