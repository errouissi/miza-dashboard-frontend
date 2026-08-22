import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import type { Agent } from "../model/agent";
import { AgentClientsPanel } from "./agent-clients-panel";

const API = "http://localhost/api/v1";
const PANEL_PATH = "/panel";

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

function clientRow(
  id: number,
  phone: string,
  status: "active" | "blocked" | "pending",
  secteur: string | null,
  createdAt: string | null,
) {
  return {
    id,
    phone,
    status,
    ville_comercial: "Rabat",
    secteur_comercial: secteur,
    solde: "0.00",
    agent: { id: 12, nom: "Alaoui", prenom: "Sara", num_compte: "CM0012" },
    created_at: createdAt,
  };
}

/**
 * `agentId` is not used to filter `rows` here — this mock always returns
 * whatever rows the test hands it. Callers that care whether the request
 * was correctly scoped assert on `agent_id` via `onRequest`/`url`
 * (see "query behavior" below), not on this handler's own response shape.
 */
function clientsHandler(
  _agentId: number,
  rows: ReturnType<typeof clientRow>[],
  onRequest?: (url: URL) => void,
  page = 1,
) {
  return http.get(`${API}/admin/clients`, ({ request }) => {
    const url = new URL(request.url);
    onRequest?.(url);
    return HttpResponse.json({
      success: true,
      data: {
        data: rows,
        current_page: page,
        per_page: 15,
        total: rows.length,
        last_page: page,
      },
    });
  });
}

function renderPanel(agent: Agent) {
  const router = createMemoryRouter(
    [
      { path: PANEL_PATH, element: <AgentClientsPanel agent={agent} /> },
      {
        path: "/network/clients/:id",
        element: <div>CLIENT DETAIL PAGE</div>,
      },
    ],
    { initialEntries: [PANEL_PATH] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.VIEW_CLIENTS]);
});

describe("permission gating — view-clients only, no unauthorized request", () => {
  it("renders nothing and never requests the endpoint without view-clients", () => {
    signInWith([PERMISSIONS.VIEW_AGENTS]);
    let requested = false;
    server.use(clientsHandler(12, [], () => (requested = true)));
    renderPanel(commercialAgent);

    expect(screen.queryByText("Clients")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("renders the panel with view-clients alone", async () => {
    server.use(clientsHandler(12, []));
    renderPanel(commercialAgent);

    expect(await screen.findByText("Clients")).toBeInTheDocument();
  });
});

describe("role gating — commercial only", () => {
  it("renders nothing and never requests the endpoint for a manager", () => {
    let requested = false;
    server.use(clientsHandler(5, [], () => (requested = true)));
    renderPanel(managerAgent);

    expect(screen.queryByText("Clients")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });
});

describe("query behavior", () => {
  it("scopes the request to this exact commercial's agent_id", async () => {
    let url: URL | undefined;
    server.use(clientsHandler(12, [], (u) => (url = u)));
    renderPanel(commercialAgent);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("agent_id")).toBe("12");
  });
});

describe("populated list", () => {
  it("renders phone, status, sector and joined for each client", async () => {
    server.use(
      clientsHandler(12, [
        clientRow(1, "0612345678", "active", "Agdal", "2026-02-01T10:00:00.000000Z"),
      ]),
    );
    renderPanel(commercialAgent);

    expect(await screen.findByText("06 12 34 56 78")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Agdal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view 0612345678/i })).toBeInTheDocument();
  });

  it("shows the absent placeholder for a client with no sector", async () => {
    server.use(
      clientsHandler(12, [
        clientRow(1, "0612345678", "active", null, "2026-02-01T10:00:00.000000Z"),
      ]),
    );
    renderPanel(commercialAgent);

    await screen.findByText("06 12 34 56 78");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("navigates using the client's OWN id (clients.id), never the commercial's agent id", async () => {
    // Manual-QA correction (Item 3): manual QA reported "This client could
    // not be found." on View. Traced end to end against the real running
    // backend (`GET /admin/clients?agent_id=X` -> `GET /admin/clients/{id}`)
    // and confirmed the identifier contract itself is correct — row 7's
    // `id` IS `clients.id`, and `ClientController::show()` expects exactly
    // that. The 404 was a REAL backend-side failure unrelated to this
    // identifier (`GrattageMarginResolver::effectiveMarginFor()` querying a
    // `grattage_settings` table whose migration had not yet been run,
    // masked by `show()`'s broad `catch (\Exception)` into a misleading
    // 404 "Client introuvable" for EVERY client — reproduced identically
    // on the existing main Clients list's own View action, not something
    // this panel introduced). No frontend change was needed or made.
    //
    // This test still earns its place: `commercialAgent.id` (12) and the
    // client's own id (7) are deliberately DISTINCT, so a future
    // regression that accidentally navigates using the agent id instead of
    // the client id would fail this assertion immediately.
    server.use(
      clientsHandler(12, [
        clientRow(7, "0699999999", "active", "Agdal", "2026-02-01T10:00:00.000000Z"),
      ]),
    );
    const router = renderPanel(commercialAgent);

    fireEvent.click(await screen.findByRole("button", { name: /view 0699999999/i }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/network/clients/7"),
    );
    expect(await screen.findByText("CLIENT DETAIL PAGE")).toBeInTheDocument();
  });
});

describe("empty state", () => {
  it("shows an empty message rather than an empty table", async () => {
    server.use(clientsHandler(12, []));
    renderPanel(commercialAgent);

    expect(
      await screen.findByText(/no client assigned to this commercial/i),
    ).toBeInTheDocument();
  });
});

describe("loading and error states", () => {
  it("shows a retryable error and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/clients`, () =>
        shouldFail
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json({
              success: true,
              data: { data: [], current_page: 1, per_page: 15, total: 0, last_page: 1 },
            }),
      ),
    );
    renderPanel(commercialAgent);

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText(/no client assigned to this commercial/i),
    ).toBeInTheDocument();
  });
});

describe("pagination", () => {
  it("requests the next page when Next is clicked", async () => {
    const rows = [
      clientRow(1, "0612345678", "active", "Agdal", "2026-02-01T10:00:00.000000Z"),
    ];
    let lastUrl: URL | undefined;
    server.use(
      http.get(`${API}/admin/clients`, ({ request }) => {
        const url = new URL(request.url);
        lastUrl = url;
        const page = Number(url.searchParams.get("page") ?? "1");
        return HttpResponse.json({
          success: true,
          data: { data: rows, current_page: page, per_page: 15, total: 30, last_page: 2 },
        });
      }),
    );
    renderPanel(commercialAgent);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(lastUrl?.searchParams.get("page")).toBe("2"));
  });
});
