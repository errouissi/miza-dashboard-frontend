import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { formatDateTime } from "@/shared/formatters";
import { AgentWorkspacePage } from "./agent-workspace-page";

const API = "http://localhost/api/v1";
const PATH = "/network/agents/:id";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const ALL_AGENT_PERMISSIONS = [
  PERMISSIONS.VIEW_AGENTS,
  PERMISSIONS.BLOCK_AGENT,
  PERMISSIONS.ACTIVATE_AGENT,
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

const managerRow = {
  id: 5,
  nom: "Idrissi",
  prenom: "Youssef",
  status: "active" as const,
  num_cin: "CIN005",
  num_ice: "ICE005",
  num_abonnement: "AB-005",
  num_compte: "MG0005",
  ville: "Casablanca",
  adresse: "12 Rue Mohammed V",
  date_ajouter: "2026-01-15T09:30:00.000000Z",
  photo_url: null,
  photo_cin_recto_url: null,
  photo_cin_verso_url: null,
  carte_auto_entrepreneur_url: "https://example.test/carte.pdf",
  certificat_habitat_url: null,
  fiche_antroprometrique_url: null,
  fiche_incident_bancaire_url: null,
  ville_sous_responsabilite: "Grand Casablanca",
  ville_actuelle: null,
  secteur: null,
  manager: null,
};

const commercialRow = {
  ...managerRow,
  id: 12,
  nom: "Alaoui",
  prenom: "Sara",
  num_cin: "CIN012",
  num_compte: "CM0012",
  ville_sous_responsabilite: null,
  ville_actuelle: "Rabat",
  secteur: "Agdal",
  manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
};

function showHandler(
  id: number,
  role: "manager" | "commercial",
  agent: object = managerRow,
) {
  return http.get(`${API}/admin/agents/${id}`, () =>
    HttpResponse.json({ success: true, role, agent }),
  );
}

function renderPage(initialPath: string) {
  const router = createMemoryRouter([{ path: PATH, element: <AgentWorkspacePage /> }], {
    initialEntries: [initialPath],
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_AGENT_PERMISSIONS);
});

describe("Agent 360 — manager variant", () => {
  it("renders manager-only identity fields, and no commercial-only fields", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    expect(
      await screen.findByRole("heading", { name: "Youssef Idrissi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Grand Casablanca")).toBeInTheDocument();
    expect(screen.queryByText("Current city")).not.toBeInTheDocument();
    expect(screen.queryByText("Sector")).not.toBeInTheDocument();
  });

  it("renders CIN, subscription, city and address", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.getByText("CIN005")).toBeInTheDocument();
    expect(screen.getByText("AB-005")).toBeInTheDocument();
    expect(screen.getByText("Casablanca")).toBeInTheDocument();
    expect(screen.getByText("12 Rue Mohammed V")).toBeInTheDocument();
  });

  it("renders dateAjout through formatDateTime, not formatDate (full timestamp)", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    // Computed via the same formatter, not hardcoded — the raw value is a
    // UTC instant, and formatDateTime renders in the runner's local zone.
    // formatDate alone would omit the time entirely, which is the actual
    // divergence this test guards.
    expect(screen.getByText(formatDateTime(managerRow.date_ajouter))).toBeInTheDocument();
  });

  it("renders only the documents actually present, as links", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.getByRole("link", { name: "Carte auto-entrepreneur" })).toHaveAttribute(
      "href",
      "https://example.test/carte.pdf",
    );
    expect(screen.queryByRole("link", { name: "Photo" })).not.toBeInTheDocument();
  });
});

describe("Agent 360 — commercial variant", () => {
  it("renders commercial-only fields, and no manager-only field", async () => {
    server.use(showHandler(12, "commercial", commercialRow));
    renderPage("/network/agents/12");

    expect(
      await screen.findByRole("heading", { name: "Sara Alaoui" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText("Rabat")).toBeInTheDocument();
    expect(screen.getByText("Agdal")).toBeInTheDocument();
    expect(screen.getByText("Youssef Idrissi")).toBeInTheDocument();
    expect(screen.queryByText("Area of responsibility")).not.toBeInTheDocument();
  });

  it("shows the absent dash when a commercial has no assigned manager", async () => {
    server.use(showHandler(12, "commercial", { ...commercialRow, manager: null }));
    renderPage("/network/agents/12");

    await screen.findByRole("heading", { name: "Sara Alaoui" });
    const managerRow = screen.getByText("Manager").closest("div");
    expect(within(managerRow!).getByText("—")).toBeInTheDocument();
  });
});

describe("loading and error states", () => {
  it("shows a skeleton while pending", () => {
    server.use(http.get(`${API}/admin/agents/5`, () => new Promise(() => {})));
    renderPage("/network/agents/5");

    expect(screen.getByRole("heading", { name: "Agent" })).toBeInTheDocument();
  });

  it("rejects an invalid id without requesting anything", () => {
    renderPage("/network/agents/not-a-number");

    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });

  it("shows a not-found message on a 404", async () => {
    server.use(
      http.get(`${API}/admin/agents/999`, () =>
        HttpResponse.json(
          { success: false, message: "Agent introuvable" },
          { status: 404 },
        ),
      ),
    );
    renderPage("/network/agents/999");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("shows a retryable error and recovers", async () => {
    // The retry policy auto-retries a transient 5xx once (`MAX_QUERY_ATTEMPTS
    // = 2`) before surfacing an error — `shouldFail` must stay true through
    // BOTH automatic attempts, so the error UI genuinely appears, before the
    // test flips it and exercises the manual Retry button. Mirrors
    // `managers-list-page.test.tsx`'s own identical pattern.
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/agents/5`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json({ success: true, role: "manager", agent: managerRow }),
      ),
    );
    renderPage("/network/agents/5");

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Youssef Idrissi" }),
    ).toBeInTheDocument();
  });
});

describe("Block/Activate — permission gating and flow", () => {
  it("offers Block for an active account, and PUTs on confirm", async () => {
    let called = false;
    server.use(
      showHandler(5, "manager"),
      http.put(`${API}/admin/agents/5/block`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "blocked" });
      }),
    );
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Block" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/block “Youssef Idrissi”/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    await waitFor(() => expect(called).toBe(true));
  });

  it("offers Activate, not Block, on a blocked account", async () => {
    server.use(showHandler(5, "manager", { ...managerRow, status: "blocked" }));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });

  it("hides Block without block-agent", async () => {
    signInWith([PERMISSIONS.VIEW_AGENTS, PERMISSIONS.ACTIVATE_AGENT]);
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });

  it("offers neither action to a read-only operator", async () => {
    signInWith([PERMISSIONS.VIEW_AGENTS]);
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });
});
