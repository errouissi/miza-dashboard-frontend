import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import type { Agent } from "../model/agent";
import { AgentStockPanel } from "./agent-stock-panel";

const API = "http://localhost/api/v1";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

const managerAgent: Agent = {
  id: 5,
  nom: "Idrissi",
  prenom: "Youssef",
  role: "manager",
  status: "active",
  numCin: "CIN005",
  numIce: "ICE005",
  numAbonnement: "AB-005",
  numCompte: "MG0005",
  ville: "Casablanca",
  adresse: "12 Rue Mohammed V",
  dateAjout: "2026-01-15T09:30:00.000000Z",
  photoUrl: null,
  photoCinRectoUrl: null,
  photoCinVersoUrl: null,
  carteAutoEntrepreneurUrl: null,
  certificatHabitatUrl: null,
  ficheAntroprometriqueUrl: null,
  ficheIncidentBancaireUrl: null,
  salaire: "3000.00",
  montantEssence: "0.00",
  montantDeclarationCnss: "1500.00",
  chargeAutoEntrepreneur: "200.00",
  villeSousResponsabilite: "Grand Casablanca",
};

const commercialAgent: Agent = {
  ...managerAgent,
  id: 12,
  nom: "Alaoui",
  prenom: "Sara",
  role: "commercial",
  villeActuelle: "Rabat",
  secteur: "Agdal",
  manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
};

function managerStockHandler(items: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/managers/5/stock`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(items);
  });
}

function pageEnvelope(rows: unknown[] = []) {
  return {
    data: rows,
    meta: { current_page: 1, per_page: 15, total: rows.length, last_page: 1 },
  };
}

function allocationsHandler(rows: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/allocations`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows));
  });
}

function agentTransfersHandler(rows: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/agent-transfers`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows));
  });
}

function agentStockReturnsHandler(rows: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/agent-stock-returns`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows));
  });
}

function stockRow(productId: number, name: string, quantity: number) {
  return {
    product_id: productId,
    name,
    operator: "IAM",
    value: 10,
    available_quantity: quantity,
  };
}

/**
 * `GET /admin/agents/{agent}/stock-quantity` (reused verbatim here). Widened
 * by backend commit `f9a6fe4` — `available_grattage` is ALWAYS present
 * alongside `stock_quantity` on a real response — and by commit `15aa704`
 * — `stock` (the product breakdown) is ALWAYS present too — so this
 * fixture defaults to a fixed decimal string and a single row consistent
 * with `quantity`, rather than omitting either. Callers that need a
 * SPECIFIC breakdown (multiple products, or a deliberately inconsistent
 * total for the "never aggregated client-side" tests) pass `stock`
 * explicitly.
 */
function stockQuantityHandler(
  quantity: number,
  onRequest?: (url: URL) => void,
  availableGrattage = "300.00",
  stock: unknown[] = quantity > 0 ? [stockRow(1, "IAM 10dh", quantity)] : [],
) {
  return http.get(`${API}/admin/agents/12/stock-quantity`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      stock_quantity: quantity,
      available_grattage: availableGrattage,
      stock,
    });
  });
}

/**
 * `GET /admin/agents/{id}/grattage-outstanding` — the SAME response
 * `useGrattageRestockGateQuery` (via its `select`) and `AgentOutstandingPanel`
 * both read; only `restock_gate` is exercised here, so `summary`/`invoices`
 * are fixed to a clear, empty shape (own copy, not imported from
 * `agent-outstanding-panel.test.tsx`, mirroring this codebase's own
 * duplication-over-shared-test-fixture discipline, ADR-0012).
 */
function gateEnvelope(blocked: boolean, reason: "OUTSTANDING_GRATTAGE" | null = null) {
  return {
    success: true,
    data: {
      agent: {
        id: 12,
        nom: "Alaoui",
        prenom: "Sara",
        num_cin: "CIN012",
        num_compte: "CM0012",
        role: "commercial",
        status: "active",
        manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
      },
      summary: {
        required_total: "0.00",
        pending_total: "0.00",
        overdue_total: "0.00",
        invoice_count: 0,
        oldest_due_at: null,
      },
      restock_gate: { blocked, reason },
      invoices: [],
    },
  };
}

function gateHandler(
  agentId: number,
  body: Parameters<typeof HttpResponse.json>[0] = gateEnvelope(false),
  onRequest?: (url: URL) => void,
) {
  return http.get(
    `${API}/admin/agents/${agentId}/grattage-outstanding`,
    ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(body);
    },
  );
}

function allocationRow(id: number) {
  return {
    id,
    allocation_number: `ALLOC-${id}`,
    status: "validated",
    montant: "500.00",
    notes: null,
    company_id: 1,
    agent_id: 5,
    admin_id: 1,
    approved_by: 1,
    approved_at: "2026-08-01T10:00:00.000000Z",
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-08-01T09:00:00.000000Z",
    updated_at: "2026-08-01T10:00:00.000000Z",
    company: { id: 1, name: "Miza" },
    agent: { id: 5, nom: "Idrissi", prenom: "Youssef" },
    creator: { id: 1, name: "Admin" },
    approver: { id: 1, name: "Admin" },
  };
}

function transferRow(id: number) {
  return {
    id,
    transfer_number: `TRF-${id}`,
    status: "validated",
    montant: "300.00",
    notes: null,
    transfer_date: "2026-08-01",
    admin_id: 1,
    manager_id: 5,
    commercial_id: 12,
    approved_by: 1,
    approved_at: "2026-08-01T10:00:00.000000Z",
    created_at: "2026-08-01T09:00:00.000000Z",
    updated_at: "2026-08-01T10:00:00.000000Z",
    creator: { id: 1, name: "Admin" },
    manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
    commercial: { id: 12, nom: "Alaoui", prenom: "Sara" },
    approver: { id: 1, name: "Admin" },
  };
}

function returnRow(id: number) {
  return {
    id,
    return_number: `RET-${id}`,
    status: "validated",
    montant: "100.00",
    notes: null,
    return_date: "2026-08-01",
    admin_id: 1,
    commercial_id: 12,
    manager_id: 5,
    approved_by: 1,
    approved_at: "2026-08-01T10:00:00.000000Z",
    created_at: "2026-08-01T09:00:00.000000Z",
    updated_at: "2026-08-01T10:00:00.000000Z",
    creator: { id: 1, name: "Admin" },
    commercial: { id: 12, nom: "Alaoui", prenom: "Sara" },
    manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
    approver: { id: 1, name: "Admin" },
  };
}

function renderPanel(agent: Agent) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <AgentStockPanel agent={agent} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Manager stock panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    signInWith([PERMISSIONS.ACCESS_DASHBOARD, PERMISSIONS.VIEW_ALLOCATIONS]);
  });

  it("never requests the Commercial-only stock-quantity/available_grattage read, even with access-dashboard held", async () => {
    let commercialReadRequested = false;
    server.use(
      managerStockHandler([]),
      allocationsHandler([]),
      http.get(`${API}/admin/agents/5/stock-quantity`, () => {
        commercialReadRequested = true;
        return HttpResponse.json({
          stock_quantity: 0,
          available_grattage: "0.00",
          stock: [],
        });
      }),
    );
    renderPanel(managerAgent);

    await screen.findByText(/no stock allocated to this manager/i);
    expect(screen.queryByText("Available Grattage")).not.toBeInTheDocument();
    expect(commercialReadRequested).toBe(false);
  });

  it("shows the authoritative current-stock table — operator/product/quantity only, no derived total", async () => {
    server.use(
      managerStockHandler([
        {
          product_id: 1,
          name: "Recharge 50",
          operator: "Orange",
          value: 50,
          available_quantity: 20,
        },
      ]),
      allocationsHandler([]),
    );
    renderPanel(managerAgent);

    expect(await screen.findByText("Recharge 50")).toBeInTheDocument();
    expect(screen.getByText("Orange")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    // No monetary total anywhere near the table (value * quantity is never computed).
    expect(screen.queryByText("1000")).not.toBeInTheDocument();
    expect(screen.queryByText(/1[\s ]?000/)).not.toBeInTheDocument();
  });

  it("shows an empty message when the manager has no stock", async () => {
    server.use(managerStockHandler([]), allocationsHandler([]));
    renderPanel(managerAgent);

    expect(
      await screen.findByText(/no stock allocated to this manager/i),
    ).toBeInTheDocument();
  });

  it("filters allocations by the exact agent_id (the recipient manager)", async () => {
    let url: URL | undefined;
    server.use(
      managerStockHandler([]),
      allocationsHandler([], (u) => (url = u)),
    );
    renderPanel(managerAgent);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("agent_id")).toBe("5");
  });

  it("renders a filtered View all link for Allocations", async () => {
    server.use(managerStockHandler([]), allocationsHandler([allocationRow(1)]));
    renderPanel(managerAgent);

    expect(await screen.findByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/stock/allocations?agent_id=5",
    );
  });

  it("hides Current stock without access-dashboard, independent of view-allocations", async () => {
    signInWith([PERMISSIONS.VIEW_ALLOCATIONS]);
    let stockRequested = false;
    server.use(
      managerStockHandler([], () => (stockRequested = true)),
      allocationsHandler([allocationRow(1)]),
    );
    renderPanel(managerAgent);

    await screen.findByText("Recent allocations");
    expect(screen.queryByText("Current stock")).not.toBeInTheDocument();
    expect(stockRequested).toBe(false);
  });

  it("hides Allocations without view-allocations, independent of access-dashboard", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    let allocationsRequested = false;
    server.use(
      managerStockHandler([]),
      allocationsHandler([], () => (allocationsRequested = true)),
    );
    renderPanel(managerAgent);

    await screen.findByText("Current stock");
    expect(screen.queryByText("Recent allocations")).not.toBeInTheDocument();
    expect(allocationsRequested).toBe(false);
  });

  it("mounts neither query without either permission", () => {
    signInWith([]);
    let stockRequested = false;
    let allocationsRequested = false;
    server.use(
      managerStockHandler([], () => (stockRequested = true)),
      allocationsHandler([], () => (allocationsRequested = true)),
    );
    renderPanel(managerAgent);

    expect(stockRequested).toBe(false);
    expect(allocationsRequested).toBe(false);
  });

  it("shows a retryable error on the stock table and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/managers/5/stock`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json([
              {
                product_id: 1,
                name: "Recharge 50",
                operator: "Orange",
                value: 50,
                available_quantity: 5,
              },
            ]),
      ),
      allocationsHandler([]),
    );
    renderPanel(managerAgent);

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recharge 50")).toBeInTheDocument();
  });
});

describe("Commercial stock panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    signInWith([PERMISSIONS.VIEW_AGENT_TRANSFERS, PERMISSIONS.VIEW_AGENT_STOCK_RETURN]);
  });

  it("hides Current stock AND Available Grattage without access-dashboard, independent of Transfers/Returns", async () => {
    let stockRequested = false;
    let gateRequested = false;
    server.use(
      stockQuantityHandler(3, () => (stockRequested = true), "300.00"),
      gateHandler(12, gateEnvelope(false), () => (gateRequested = true)),
      agentTransfersHandler([transferRow(1)]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    await screen.findByText("Recent transfers");
    expect(screen.queryByText("Current stock")).not.toBeInTheDocument();
    expect(screen.queryByText("Available Grattage")).not.toBeInTheDocument();
    expect(stockRequested).toBe(false);
    expect(gateRequested).toBe(false);
  });

  it("shows a loading state, then the empty-stock state AND Available Grattage together (zero stock, positive capacity)", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(0, undefined, "4800.00"),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("Current stock")).toBeInTheDocument();
    expect(await screen.findByText("No stock currently held.")).toBeInTheDocument();
    expect(screen.getByText("Available Grattage")).toBeInTheDocument();
    expect(screen.getByText("4800.00")).toBeInTheDocument();
  });

  it("shows positive stock's Total stock summary alongside its own remaining Available Grattage — independent numbers, not derived from each other", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(7, undefined, "300.00"),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("Total stock: 7 units")).toBeInTheDocument();
    expect(screen.getByText("300.00")).toBeInTheDocument();
  });

  it("displays zero Available Grattage as '0.00', not an empty/omitted state", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(2, undefined, "0.00"),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    await screen.findByText("Total stock: 2 units");
    expect(screen.getByText("Available Grattage")).toBeInTheDocument();
    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("renders the backend's decimal string verbatim — no rounding, no reformatting, no currency suffix invented", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(1, undefined, "1234.56"),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    // Exact string, unmangled: not "1 234,56", not "1234.56 DH", not "1,234.56".
    expect(await screen.findByText("1234.56")).toBeInTheDocument();
    expect(screen.queryByText(/DH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1[\s ]234/)).not.toBeInTheDocument();
  });

  it("shows a retryable error affecting Current stock AND Available Grattage together, and recovers both from one retry", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/agents/12/stock-quantity`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json({
              stock_quantity: 4,
              available_grattage: "150.00",
              stock: [stockRow(1, "IAM 10dh", 4)],
            }),
      ),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Total stock: 4 units")).toBeInTheDocument();
    expect(await screen.findByText("IAM 10dh")).toBeInTheDocument();
    expect(screen.getByText("150.00")).toBeInTheDocument();
  });

  it("requests stock-quantity by this exact commercial's id, gated on access-dashboard alone", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    let requested = false;
    server.use(
      stockQuantityHandler(1, () => (requested = true)),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    await waitFor(() => expect(requested).toBe(true));
  });

  it("renders exactly one product row with the exact Operator / Product / Available quantity values", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(1, undefined, "0.00", [stockRow(9, "IAM 10dh", 1)]),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(
      await screen.findByRole("columnheader", { name: "Operator" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Product" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Available quantity" }),
    ).toBeInTheDocument();
    const row = screen.getByText("IAM 10dh").closest("tr")!;
    expect(within(row).getByText("IAM")).toBeInTheDocument();
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1 data row
  });

  it("renders multiple product rows, each with its own operator, name and quantity", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(3, undefined, "0.00", [
        stockRow(1, "IAM 10dh", 1),
        { ...stockRow(2, "Orange 5dh", 2), operator: "Orange" },
      ]),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    const iamRow = (await screen.findByText("IAM 10dh")).closest("tr")!;
    const orangeRow = screen.getByText("Orange 5dh").closest("tr")!;
    expect(within(iamRow).getByText("IAM")).toBeInTheDocument();
    expect(within(iamRow).getByText("1")).toBeInTheDocument();
    expect(within(orangeRow).getByText("Orange")).toBeInTheDocument();
    expect(within(orangeRow).getByText("2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 data rows
  });

  it("shows 'No stock currently held.' — a real empty state, not a headerless/rowless table — when stock is empty", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(0, undefined, "500.00", []),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("No stock currently held.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Operator" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Product" }),
    ).not.toBeInTheDocument();
    // Available Grattage renders independently of the empty stock state.
    expect(screen.getByText("Available Grattage")).toBeInTheDocument();
    expect(screen.getByText("500.00")).toBeInTheDocument();
  });

  it("reads Total stock from stock_quantity verbatim — never sums the visible rows to recreate it", async () => {
    // Deliberately inconsistent fixture (sum of rows = 3, stock_quantity = 99):
    // a real backend response never does this, but it proves the displayed
    // total is read directly from `stock_quantity`, not computed from `stock`.
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(99, undefined, "0.00", [
        stockRow(1, "IAM 10dh", 1),
        stockRow(2, "Orange 5dh", 2),
      ]),
      gateHandler(12),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("Total stock: 99 units")).toBeInTheDocument();
    expect(screen.queryByText("Total stock: 3 units")).not.toBeInTheDocument();
  });

  it("shows the 'currently unavailable for transfer' helper beside Available Grattage when the restock gate is blocked", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(2, undefined, "460.00"),
      gateHandler(12, gateEnvelope(true, "OUTSTANDING_GRATTAGE")),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    // The numeric capacity is never zeroed or hidden by a blocked gate.
    expect(await screen.findByText("460.00")).toBeInTheDocument();
    expect(
      await screen.findByText(/currently unavailable for transfer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /outstanding grattage must be settled before new stock can be received/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not show the helper when the restock gate is not blocked", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(2, undefined, "460.00"),
      gateHandler(12, gateEnvelope(false)),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("460.00")).toBeInTheDocument();
    expect(
      screen.queryByText(/currently unavailable for transfer/i),
    ).not.toBeInTheDocument();
  });

  it("keeps Available Grattage visible while the restock-gate read is still pending, with no helper shown yet", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    let resolveGate: (body: ReturnType<typeof gateEnvelope>) => void = () => {};
    const gatePending = new Promise<ReturnType<typeof gateEnvelope>>((resolve) => {
      resolveGate = resolve;
    });
    server.use(
      stockQuantityHandler(2, undefined, "300.00"),
      http.get(`${API}/admin/agents/12/grattage-outstanding`, async () =>
        HttpResponse.json(await gatePending),
      ),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    // Capacity depends only on stock-quantity, which already resolved —
    // it must not wait on the still-pending gate read.
    expect(await screen.findByText("300.00")).toBeInTheDocument();
    expect(
      screen.queryByText(/currently unavailable for transfer/i),
    ).not.toBeInTheDocument();

    // Settle the still-open handler so the test doesn't leave a dangling request.
    resolveGate(gateEnvelope(false));
  });

  it("keeps Available Grattage visible and shows no blocked/unblocked claim when the restock-gate read errors", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      stockQuantityHandler(2, undefined, "300.00"),
      http.get(`${API}/admin/agents/12/grattage-outstanding`, () =>
        HttpResponse.json({ success: false, message: "boom" }, { status: 500 }),
      ),
      agentTransfersHandler([]),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("300.00")).toBeInTheDocument();
    // Never inferred as "not blocked" from a failed/unknown read — the
    // helper only ever appears on a confirmed blocked:true.
    expect(
      screen.queryByText(/currently unavailable for transfer/i),
    ).not.toBeInTheDocument();
    // Stays absent through the retry policy's one 5xx retry too.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(
      screen.queryByText(/currently unavailable for transfer/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("300.00")).toBeInTheDocument();
  });

  it("filters transfers by the exact commercial_id", async () => {
    let url: URL | undefined;
    server.use(
      agentTransfersHandler([], (u) => (url = u)),
      agentStockReturnsHandler([]),
    );
    renderPanel(commercialAgent);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("commercial_id")).toBe("12");
    expect(url?.searchParams.get("agent_id")).toBeNull();
  });

  it("filters returns by the exact commercial_id", async () => {
    let url: URL | undefined;
    server.use(
      agentTransfersHandler([]),
      agentStockReturnsHandler([], (u) => (url = u)),
    );
    renderPanel(commercialAgent);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("commercial_id")).toBe("12");
  });

  it("renders filtered View all links for both Transfers and Returns", async () => {
    server.use(
      agentTransfersHandler([transferRow(1)]),
      agentStockReturnsHandler([returnRow(1)]),
    );
    renderPanel(commercialAgent);

    await screen.findByText("Recent transfers");
    const links = screen.getAllByRole("link", { name: "View all" });
    expect(links[0]).toHaveAttribute("href", "/stock/agent-transfers?commercial_id=12");
    expect(links[1]).toHaveAttribute(
      "href",
      "/stock/agent-stock-returns?commercial_id=12",
    );
  });

  it("hides Transfers without view-agent-transfers, independent of Returns", async () => {
    signInWith([PERMISSIONS.VIEW_AGENT_STOCK_RETURN]);
    let transfersRequested = false;
    server.use(
      agentTransfersHandler([], () => (transfersRequested = true)),
      agentStockReturnsHandler([returnRow(1)]),
    );
    renderPanel(commercialAgent);

    await screen.findByText("Recent returns");
    expect(screen.queryByText("Recent transfers")).not.toBeInTheDocument();
    expect(transfersRequested).toBe(false);
  });

  it("hides Returns without view-agent-stock-return, independent of Transfers", async () => {
    signInWith([PERMISSIONS.VIEW_AGENT_TRANSFERS]);
    let returnsRequested = false;
    server.use(
      agentTransfersHandler([transferRow(1)]),
      agentStockReturnsHandler([], () => (returnsRequested = true)),
    );
    renderPanel(commercialAgent);

    await screen.findByText("Recent transfers");
    expect(screen.queryByText("Recent returns")).not.toBeInTheDocument();
    expect(returnsRequested).toBe(false);
  });

  it("mounts no query — stock, transfers, returns, or restock-gate — without any permission", () => {
    signInWith([]);
    let stockRequested = false;
    let gateRequested = false;
    let transfersRequested = false;
    let returnsRequested = false;
    server.use(
      stockQuantityHandler(0, () => (stockRequested = true)),
      gateHandler(12, gateEnvelope(false), () => (gateRequested = true)),
      agentTransfersHandler([], () => (transfersRequested = true)),
      agentStockReturnsHandler([], () => (returnsRequested = true)),
    );
    renderPanel(commercialAgent);

    expect(stockRequested).toBe(false);
    expect(gateRequested).toBe(false);
    expect(transfersRequested).toBe(false);
    expect(returnsRequested).toBe(false);
  });

  it("shows up to 5 rows, an empty message otherwise", async () => {
    const rows = [1, 2, 3, 4, 5, 6].map(transferRow);
    server.use(agentTransfersHandler(rows), agentStockReturnsHandler([]));
    renderPanel(commercialAgent);

    // Wait for actual rows, not just the heading — the heading renders
    // immediately while the query is still pending (skeleton state).
    await screen.findAllByRole("listitem");
    const list = screen.getByText("Recent transfers").closest("div")!.parentElement!;
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(
      await screen.findByText(/no returns yet for this commercial/i),
    ).toBeInTheDocument();
  });
});
