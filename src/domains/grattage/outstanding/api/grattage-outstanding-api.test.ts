import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchGrattageOutstanding } from "./grattage-outstanding-api";

const API = "http://localhost/api/v1";

/**
 * A plain, no-React unit test of the mapper — this module has no page to
 * render it through (M6 Phase 2 deliberately ships no UI). MSW's global
 * `server` (wired in `src/test/setup.ts`) is shared across every test
 * file regardless of whether a component is rendered, so a direct
 * `fetchGrattageOutstanding` call is exercised exactly like any other
 * mapper, just without a DOM in between.
 */

/** `AgentController::grattageOutstanding`'s own response shape, verified fresh from source this phase. */
function outstandingEnvelope(
  overrides: Partial<{
    agent: {
      id: number;
      nom: string;
      prenom: string;
      num_cin: string;
      num_compte: string;
      role: string;
      status: string;
      manager: { id: number; nom: string; prenom: string } | null;
    };
    summary: {
      required_total: string;
      pending_total: string;
      overdue_total: string;
      invoice_count: number;
      oldest_due_at: string | null;
    };
    restock_gate: {
      blocked: boolean;
      reason: "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE" | null;
    };
    invoices: {
      id: number;
      status: "pending" | "overdue";
      total_amount: string;
      sold_at: string;
      due_at: string;
      declared_at: string | null;
      days_overdue: number | null;
    }[];
  }> = {},
) {
  return {
    success: true,
    data: {
      agent: {
        id: 1,
        nom: "Alaoui",
        prenom: "Sara",
        num_cin: "CIN001",
        num_compte: "CM0001",
        role: "commercial",
        status: "active",
        manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
      },
      summary: {
        required_total: "150.00",
        pending_total: "100.00",
        overdue_total: "50.00",
        invoice_count: 2,
        oldest_due_at: "2026-08-02T12:00:00.000000Z",
      },
      restock_gate: { blocked: true, reason: "OUTSTANDING_GRATTAGE" as const },
      invoices: [],
      ...overrides,
    },
  };
}

function outstandingHandler(
  agentId: number,
  envelope: ReturnType<typeof outstandingEnvelope>,
) {
  return http.get(`${API}/admin/agents/${agentId}/grattage-outstanding`, () =>
    HttpResponse.json(envelope),
  );
}

describe("fetchGrattageOutstanding", () => {
  it("maps the full response — agent, summary, restockGate, invoices", async () => {
    server.use(outstandingHandler(1, outstandingEnvelope()));

    const result = await fetchGrattageOutstanding(1);

    expect(result.agent).toEqual({
      id: 1,
      nom: "Alaoui",
      prenom: "Sara",
      numCin: "CIN001",
      numCompte: "CM0001",
      role: "commercial",
      status: "active",
      manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
    });
    expect(result.summary).toEqual({
      requiredTotal: "150.00",
      pendingTotal: "100.00",
      overdueTotal: "50.00",
      invoiceCount: 2,
      oldestDueAt: "2026-08-02T12:00:00.000000Z",
    });
    expect(result.restockGate).toEqual({ blocked: true, reason: "OUTSTANDING_GRATTAGE" });
  });

  it("carries decimal amounts as strings, never parsed to a number", async () => {
    server.use(
      outstandingHandler(
        1,
        outstandingEnvelope({
          summary: {
            required_total: "1500.00",
            pending_total: "1500.00",
            overdue_total: "0.00",
            invoice_count: 1,
            oldest_due_at: null,
          },
        }),
      ),
    );

    const result = await fetchGrattageOutstanding(1);

    expect(result.summary.requiredTotal).toBe("1500.00");
    expect(typeof result.summary.requiredTotal).toBe("string");
  });

  it("maps a manager's TEAM_OUTSTANDING_GRATTAGE gate, with no manager of their own", async () => {
    server.use(
      outstandingHandler(
        5,
        outstandingEnvelope({
          agent: {
            id: 5,
            nom: "Idrissi",
            prenom: "Youssef",
            num_cin: "CIN005",
            num_compte: "MG0005",
            role: "manager",
            status: "active",
            manager: null,
          },
          restock_gate: { blocked: true, reason: "TEAM_OUTSTANDING_GRATTAGE" },
        }),
      ),
    );

    const result = await fetchGrattageOutstanding(5);

    expect(result.agent.manager).toBeNull();
    expect(result.restockGate).toEqual({
      blocked: true,
      reason: "TEAM_OUTSTANDING_GRATTAGE",
    });
  });

  it("maps a clear gate — blocked false, reason null", async () => {
    server.use(
      outstandingHandler(
        1,
        outstandingEnvelope({ restock_gate: { blocked: false, reason: null } }),
      ),
    );

    const result = await fetchGrattageOutstanding(1);

    expect(result.restockGate).toEqual({ blocked: false, reason: null });
  });

  it("maps the invoices list, including a null daysOverdue for a pending line", async () => {
    server.use(
      outstandingHandler(
        1,
        outstandingEnvelope({
          invoices: [
            {
              id: 10,
              status: "pending",
              total_amount: "100.00",
              sold_at: "2026-08-01T09:00:00.000000Z",
              due_at: "2026-08-02T12:00:00.000000Z",
              declared_at: null,
              days_overdue: null,
            },
            {
              id: 11,
              status: "overdue",
              total_amount: "50.00",
              sold_at: "2026-07-30T09:00:00.000000Z",
              due_at: "2026-07-31T12:00:00.000000Z",
              declared_at: null,
              days_overdue: 3,
            },
          ],
        }),
      ),
    );

    const result = await fetchGrattageOutstanding(1);

    expect(result.invoices).toEqual([
      {
        id: 10,
        status: "pending",
        totalAmount: "100.00",
        soldAt: "2026-08-01T09:00:00.000000Z",
        dueAt: "2026-08-02T12:00:00.000000Z",
        declaredAt: null,
        daysOverdue: null,
      },
      {
        id: 11,
        status: "overdue",
        totalAmount: "50.00",
        soldAt: "2026-07-30T09:00:00.000000Z",
        dueAt: "2026-07-31T12:00:00.000000Z",
        declaredAt: null,
        daysOverdue: 3,
      },
    ]);
  });

  it("requests the exact agent-scoped endpoint, with no query params", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/agents/7/grattage-outstanding`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(outstandingEnvelope());
      }),
    );

    await fetchGrattageOutstanding(7);

    expect(url?.pathname).toBe("/api/v1/admin/agents/7/grattage-outstanding");
    expect(url?.search).toBe("");
  });
});
