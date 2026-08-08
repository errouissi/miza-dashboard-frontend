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

  it("shows the authoritative current-stock table — product/quantity only, no derived total", async () => {
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

  it("never renders a current-stock subsection — no authoritative endpoint exists", async () => {
    server.use(agentTransfersHandler([transferRow(1)]), agentStockReturnsHandler([]));
    renderPanel(commercialAgent);

    await screen.findByText("Recent transfers");
    expect(screen.queryByText("Current stock")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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

  it("mounts neither query without either permission", () => {
    signInWith([]);
    let transfersRequested = false;
    let returnsRequested = false;
    server.use(
      agentTransfersHandler([], () => (transfersRequested = true)),
      agentStockReturnsHandler([], () => (returnsRequested = true)),
    );
    renderPanel(commercialAgent);

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
