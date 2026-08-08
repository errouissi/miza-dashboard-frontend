import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import type { Agent } from "../model/agent";
import { AgentOutstandingPanel } from "./agent-outstanding-panel";

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

function outstandingAgentRow(id: number, role: "manager" | "commercial") {
  return {
    id,
    nom: role === "manager" ? "Idrissi" : "Alaoui",
    prenom: role === "manager" ? "Youssef" : "Sara",
    num_cin: role === "manager" ? "CIN005" : "CIN012",
    num_compte: role === "manager" ? "MG0005" : "CM0012",
    role,
    status: "active",
    manager: role === "commercial" ? { id: 5, nom: "Idrissi", prenom: "Youssef" } : null,
  };
}

function clearEnvelope(id: number, role: "manager" | "commercial") {
  return {
    success: true,
    data: {
      agent: outstandingAgentRow(id, role),
      summary: {
        required_total: "0.00",
        pending_total: "0.00",
        overdue_total: "0.00",
        invoice_count: 0,
        oldest_due_at: null,
      },
      restock_gate: { blocked: false, reason: null },
      invoices: [],
    },
  };
}

function outstandingInvoiceRow(id: number, status: "pending" | "overdue") {
  return {
    id,
    status,
    total_amount: "150.00",
    sold_at: "2026-08-01T09:00:00.000000Z",
    due_at: "2026-08-02T12:00:00.000000Z",
    declared_at: null,
    days_overdue: status === "overdue" ? 3 : null,
  };
}

function blockedCommercialEnvelope(invoiceCount = 1) {
  const invoices = Array.from({ length: invoiceCount }, (_, i) =>
    outstandingInvoiceRow(i + 1, i === 0 ? "overdue" : "pending"),
  );
  return {
    success: true,
    data: {
      agent: outstandingAgentRow(12, "commercial"),
      summary: {
        required_total: "450.00",
        pending_total: "300.00",
        overdue_total: "150.00",
        invoice_count: invoiceCount,
        oldest_due_at: "2026-08-02T12:00:00.000000Z",
      },
      restock_gate: { blocked: true, reason: "OUTSTANDING_GRATTAGE" },
      invoices,
    },
  };
}

function blockedManagerEnvelope() {
  return {
    success: true,
    data: {
      agent: outstandingAgentRow(5, "manager"),
      summary: {
        required_total: "0.00",
        pending_total: "0.00",
        overdue_total: "0.00",
        invoice_count: 0,
        oldest_due_at: null,
      },
      restock_gate: { blocked: true, reason: "TEAM_OUTSTANDING_GRATTAGE" },
      invoices: [],
    },
  };
}

function outstandingHandler(
  agentId: number,
  body: Parameters<typeof HttpResponse.json>[0],
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

function renderPanel(agent: Agent) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <AgentOutstandingPanel agent={agent} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const FORBIDDEN_WORDING = [
  /agent is blocked/i,
  /agent.*globally blocked/i,
  /manager is blocked/i,
  /allocation/i,
  /all stock operations/i,
];

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
});

describe("permission gating — access-dashboard only, no unauthorized request", () => {
  it("renders nothing and never requests the endpoint without access-dashboard", () => {
    signInWith([PERMISSIONS.VIEW_AGENTS]);
    let requested = false;
    server.use(
      outstandingHandler(5, clearEnvelope(5, "manager"), () => (requested = true)),
    );
    renderPanel(managerAgent);

    expect(screen.queryByText("Grattage Outstanding")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("renders the panel with access-dashboard alone", async () => {
    server.use(outstandingHandler(5, clearEnvelope(5, "manager")));
    renderPanel(managerAgent);

    expect(await screen.findByText("Grattage Outstanding")).toBeInTheDocument();
  });

  it("requests the exact agent id", async () => {
    let url: URL | undefined;
    server.use(outstandingHandler(12, clearEnvelope(12, "commercial"), (u) => (url = u)));
    renderPanel(commercialAgent);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.pathname).toBe("/api/v1/admin/agents/12/grattage-outstanding");
  });
});

describe("Commercial — clear state", () => {
  it("shows the clear message, no gate banner, no invoice list", async () => {
    server.use(outstandingHandler(12, clearEnvelope(12, "commercial")));
    renderPanel(commercialAgent);

    expect(
      await screen.findByText("No outstanding grattage obligation."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/currently blocked/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Outstanding invoices")).not.toBeInTheDocument();
  });
});

describe("Commercial — outstanding state", () => {
  it("shows required/pending/overdue totals and the oldest due date", async () => {
    server.use(outstandingHandler(12, blockedCommercialEnvelope(2)));
    renderPanel(commercialAgent);

    expect(await screen.findByText(/450\.00 DH/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pending 300\.00 DH · Overdue 150\.00 DH/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Oldest due/)).toBeInTheDocument();
  });

  it("shows the gate banner scoped explicitly to Agent Transfer eligibility, never global/Manager/Allocation wording", async () => {
    server.use(outstandingHandler(12, blockedCommercialEnvelope(1)));
    renderPanel(commercialAgent);

    expect(
      await screen.findByText(
        "New stock transfers to this Commercial are currently blocked until this outstanding Grattage obligation is settled.",
      ),
    ).toBeInTheDocument();
    for (const forbidden of FORBIDDEN_WORDING) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("does not show the gate banner when restockGate.blocked is false, even with an outstanding balance", async () => {
    server.use(
      outstandingHandler(12, {
        success: true,
        data: {
          ...blockedCommercialEnvelope(1).data,
          restock_gate: { blocked: false, reason: null },
        },
      }),
    );
    renderPanel(commercialAgent);

    await screen.findByText(/450\.00 DH/);
    expect(screen.queryByText(/currently blocked/i)).not.toBeInTheDocument();
  });

  it("renders up to 5 outstanding invoices, each deep-linking to its invoice detail page", async () => {
    server.use(outstandingHandler(12, blockedCommercialEnvelope(7)));
    renderPanel(commercialAgent);

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(5);
    const links = screen.getAllByRole("link", { name: /150\.00 DH/ });
    expect(links[0]).toHaveAttribute("href", "/grattage/invoices/1");
  });

  it("shows days overdue only for an overdue invoice", async () => {
    server.use(outstandingHandler(12, blockedCommercialEnvelope(1)));
    renderPanel(commercialAgent);

    expect(await screen.findByText(/3d overdue/)).toBeInTheDocument();
  });
});

describe("Manager — clear state", () => {
  it("shows only the coarse clear message", async () => {
    server.use(outstandingHandler(5, clearEnvelope(5, "manager")));
    renderPanel(managerAgent);

    expect(
      await screen.findByText(
        "No commercial on this team currently has an outstanding grattage obligation.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Manager — team-outstanding state", () => {
  it("shows only the coarse blocked message — no amount, no invoice count, no commercial identity, no Allocation wording", async () => {
    server.use(outstandingHandler(5, blockedManagerEnvelope()));
    renderPanel(managerAgent);

    expect(
      await screen.findByText(
        "One or more commercials on this team have an outstanding grattage obligation.",
      ),
    ).toBeInTheDocument();
    // Nothing beyond the one sentence — no amount/count/DH figure anywhere.
    expect(screen.queryByText(/DH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alaoui|Sara/)).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    for (const forbidden of FORBIDDEN_WORDING) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });
});

describe("loading and error states", () => {
  it("shows a retryable error and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/agents/5/grattage-outstanding`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(clearEnvelope(5, "manager")),
      ),
    );
    renderPanel(managerAgent);

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText(
        "No commercial on this team currently has an outstanding grattage obligation.",
      ),
    ).toBeInTheDocument();
  });
});
