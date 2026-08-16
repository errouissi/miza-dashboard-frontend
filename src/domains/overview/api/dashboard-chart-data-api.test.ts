import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { toIsoDate } from "@/shared/formatters";
import { fetchDashboardChartData } from "./dashboard-chart-data-api";

const API = "http://localhost/api/v1";

function isoDaysAgo(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return toIsoDate(d)!;
}

function chartDataEnvelope(
  overrides: Partial<{
    deposits_over_time: { date: string; count: number; total_amount: string }[];
    agent_registrations: { date: string; role: string; count: number }[];
  }> = {},
) {
  return {
    deposits_over_time: overrides.deposits_over_time ?? [],
    deposits_by_method: [{ method: "bank", count: 1, total_amount: "20.00" }],
    agents_by_city: [{ ville_actuelle: "marrakech", count: 1 }],
    agent_registrations: overrides.agent_registrations ?? [],
  };
}

function chartDataHandler(
  envelope: ReturnType<typeof chartDataEnvelope> = chartDataEnvelope(),
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/dashboard/chart-data`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(envelope);
  });
}

describe("fetchDashboardChartData — deposit submissions", () => {
  it("requests the exact endpoint with the days param", async () => {
    let url: URL | undefined;
    server.use(chartDataHandler(chartDataEnvelope(), (u) => (url = u)));

    await fetchDashboardChartData(30);

    expect(url?.pathname).toBe("/api/v1/admin/dashboard/chart-data");
    expect(url?.searchParams.get("days")).toBe("30");
  });

  it("maps a real row verbatim — totalAmount as a string, isZeroFilled false", async () => {
    const today = isoDaysAgo(0);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          deposits_over_time: [{ date: today, count: 3, total_amount: "128450.75" }],
        }),
      ),
    );

    const result = await fetchDashboardChartData(30);
    const real = result.depositSubmissions.points.find((p) => p.date === today);

    expect(real).toEqual({
      date: today,
      count: 3,
      totalAmount: "128450.75",
      isZeroFilled: false,
    });
    expect(typeof real?.totalAmount).toBe("string");
  });

  it("zero-fills missing dates within the window with the literal display value 0.00", async () => {
    server.use(chartDataHandler(chartDataEnvelope({ deposits_over_time: [] })));

    const result = await fetchDashboardChartData(7);

    expect(result.depositSubmissions.points).toHaveLength(7);
    for (const point of result.depositSubmissions.points) {
      expect(point.totalAmount).toBe("0.00");
      expect(point.count).toBe(0);
      expect(point.isZeroFilled).toBe(true);
    }
  });

  it("produces a continuous, ascending-date series for a partially populated window", async () => {
    const today = isoDaysAgo(0);
    const twoDaysAgo = isoDaysAgo(2);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          deposits_over_time: [
            { date: twoDaysAgo, count: 1, total_amount: "10.00" },
            { date: today, count: 2, total_amount: "30.00" },
          ],
        }),
      ),
    );

    const result = await fetchDashboardChartData(7);

    expect(result.depositSubmissions.points).toHaveLength(7);
    const dates = result.depositSubmissions.points.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());

    const day2 = result.depositSubmissions.points.find((p) => p.date === twoDaysAgo);
    const day0 = result.depositSubmissions.points.find((p) => p.date === today);
    expect(day2).toEqual({
      date: twoDaysAgo,
      count: 1,
      totalAmount: "10.00",
      isZeroFilled: false,
    });
    expect(day0).toEqual({
      date: today,
      count: 2,
      totalAmount: "30.00",
      isZeroFilled: false,
    });

    const yesterday = isoDaysAgo(1);
    const filled = result.depositSubmissions.points.find((p) => p.date === yesterday);
    expect(filled).toEqual({
      date: yesterday,
      count: 0,
      totalAmount: "0.00",
      isZeroFilled: true,
    });
  });

  it("distinguishes a genuine real 0.00 backend row from a client zero-filled day", async () => {
    const today = isoDaysAgo(0);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          deposits_over_time: [{ date: today, count: 1, total_amount: "0.00" }],
        }),
      ),
    );

    const result = await fetchDashboardChartData(3);
    const real = result.depositSubmissions.points.find((p) => p.date === today);

    expect(real).toEqual({
      date: today,
      count: 1,
      totalAmount: "0.00",
      isZeroFilled: false,
    });
  });

  it("hasData is false when the backend returns an entirely empty series", async () => {
    server.use(chartDataHandler(chartDataEnvelope({ deposits_over_time: [] })));

    const result = await fetchDashboardChartData(30);

    expect(result.depositSubmissions.hasData).toBe(false);
  });

  it("hasData is true when at least one real row exists", async () => {
    const today = isoDaysAgo(0);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          deposits_over_time: [{ date: today, count: 1, total_amount: "5.00" }],
        }),
      ),
    );

    const result = await fetchDashboardChartData(30);

    expect(result.depositSubmissions.hasData).toBe(true);
  });
});

describe("fetchDashboardChartData — agent registrations", () => {
  it("maps real rows and derives roles only from what the backend actually returned", async () => {
    const today = isoDaysAgo(0);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          agent_registrations: [
            { date: today, role: "commercial", count: 2 },
            { date: today, role: "manager", count: 1 },
          ],
        }),
      ),
    );

    const result = await fetchDashboardChartData(3);

    expect(result.agentRegistrations.roles).toEqual(["commercial", "manager"]);
    expect(result.agentRegistrations.hasData).toBe(true);
    const real = result.agentRegistrations.points.filter((p) => p.date === today);
    expect(real).toEqual([
      { date: today, role: "commercial", count: 2, isZeroFilled: false },
      { date: today, role: "manager", count: 1, isZeroFilled: false },
    ]);
  });

  it("zero-fills missing (date, role) combinations only for observed roles", async () => {
    const today = isoDaysAgo(0);
    server.use(
      chartDataHandler(
        chartDataEnvelope({
          agent_registrations: [{ date: today, role: "manager", count: 1 }],
        }),
      ),
    );

    const result = await fetchDashboardChartData(3);

    expect(result.agentRegistrations.roles).toEqual(["manager"]);
    // 3-day window, 1 observed role -> exactly 3 points, one per day.
    expect(result.agentRegistrations.points).toHaveLength(3);
    const yesterday = isoDaysAgo(1);
    const filled = result.agentRegistrations.points.find((p) => p.date === yesterday);
    expect(filled).toEqual({
      date: yesterday,
      role: "manager",
      count: 0,
      isZeroFilled: true,
    });
  });

  it("never invents a role absent from the backend response — no zero-fill roles when the series is empty", async () => {
    server.use(chartDataHandler(chartDataEnvelope({ agent_registrations: [] })));

    const result = await fetchDashboardChartData(30);

    expect(result.agentRegistrations.roles).toEqual([]);
    expect(result.agentRegistrations.points).toEqual([]);
    expect(result.agentRegistrations.hasData).toBe(false);
  });
});

describe("fetchDashboardChartData — excluded fields", () => {
  it("does not leak deposits_by_method or agents_by_city into the mapped model", async () => {
    server.use(chartDataHandler(chartDataEnvelope()));

    const result = await fetchDashboardChartData(30);

    expect(Object.keys(result)).toEqual(["depositSubmissions", "agentRegistrations"]);
    expect(result).not.toHaveProperty("depositsByMethod");
    expect(result).not.toHaveProperty("agentsByCity");
  });
});
