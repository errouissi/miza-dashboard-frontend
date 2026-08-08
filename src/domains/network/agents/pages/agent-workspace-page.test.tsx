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
  PERMISSIONS.UPDATE_AGENT,
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
  salaire: "3000.00",
  montant_essence: "0.00",
  montant_declaration_cnss: "1500.00",
  charge_auto_entrepreneur: "200.00",
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

describe("Edit — permission gating and seeding (M7 Phase 1.5)", () => {
  it("shows Edit for an operator holding update-agent", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides Edit without update-agent — independent of view-agents", async () => {
    signInWith([PERMISSIONS.VIEW_AGENTS]);
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    await screen.findByRole("heading", { name: "Youssef Idrissi" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("seeds the drawer with the manager's values, HR fields as whole numbers, and only the manager-only field", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("First name")).toHaveValue("Youssef");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("Idrissi");
    expect(within(dialog).getByLabelText("City")).toHaveValue("Casablanca");
    expect(within(dialog).getByLabelText("Address")).toHaveValue("12 Rue Mohammed V");
    expect(within(dialog).getByLabelText("CIN")).toHaveValue("CIN005");
    expect(within(dialog).getByLabelText("ICE")).toHaveValue("ICE005");
    expect(within(dialog).getByLabelText("Subscription number")).toHaveValue("AB-005");
    // Whole-number, not the wire's "3000.00" decimal string.
    expect(within(dialog).getByLabelText(/^Salary/)).toHaveValue("3000");
    expect(within(dialog).getByLabelText(/^CNSS declared amount/)).toHaveValue("1500");
    expect(within(dialog).getByLabelText(/^Auto-entrepreneur charge/)).toHaveValue("200");
    expect(within(dialog).getByLabelText("Area of responsibility")).toHaveValue(
      "Grand Casablanca",
    );
    expect(within(dialog).queryByLabelText("Current city")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Sector")).not.toBeInTheDocument();
  });

  it("seeds the drawer with the commercial's values and only the commercial-only fields", async () => {
    server.use(showHandler(12, "commercial", commercialRow));
    renderPage("/network/agents/12");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("First name")).toHaveValue("Sara");
    expect(within(dialog).getByLabelText("Current city")).toHaveValue("Rabat");
    expect(within(dialog).getByLabelText("Sector")).toHaveValue("Agdal");
    expect(
      within(dialog).queryByLabelText("Area of responsibility"),
    ).not.toBeInTheDocument();
  });
});

describe("Edit — existing file previews (M7 Phase 1.5)", () => {
  it("shows 'Current file on record' only for documents actually present", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    // Only carte_auto_entrepreneur_url is set on managerRow.
    expect(within(dialog).getAllByText("Current file on record")).toHaveLength(1);
    expect(
      within(dialog).getByRole("link", { name: "View current file" }),
    ).toHaveAttribute("href", "https://example.test/carte.pdf");
  });

  it("switches to a local preview when a replacement is selected, and reverts to the existing one on Remove", async () => {
    server.use(showHandler(5, "manager"));
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    const carteInput = within(dialog).getByLabelText(/Auto-entrepreneur card/);
    fireEvent.change(carteInput, {
      target: { files: [new File(["x"], "new-carte.pdf", { type: "application/pdf" })] },
    });

    expect(within(dialog).getByText("new-carte.pdf")).toBeInTheDocument();
    expect(within(dialog).queryByText("Current file on record")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(within(dialog).getByText("Current file on record")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "View current file" }),
    ).toBeInTheDocument();
  });
});

describe("Edit — validation, submission and errors (M7 Phase 1.5)", () => {
  it("rejects an empty required field client-side, without submitting", async () => {
    let requested = false;
    server.use(
      showHandler(5, "manager"),
      http.post(`${API}/admin/agents/5`, () => {
        requested = true;
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("First name"), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await within(dialog).findByText(/first name is required/i),
    ).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("preserves existing files when saving without selecting any replacement — sends no file keys", async () => {
    let body: FormData | undefined;
    server.use(
      showHandler(5, "manager"),
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(body).toBeDefined());
    for (const fileField of [
      "photo",
      "photo_cin_recto",
      "photo_cin_verso",
      "certificat_d_habitat",
      "carte_auto_entrepreneur",
      "fiche_antroprometrique",
      "fiche_d_incident_banquaire",
    ]) {
      expect(body?.has(fileField)).toBe(false);
    }
  });

  it("closes and refetches after a successful update, showing the new value without a manual reload", async () => {
    let currentRow = { ...managerRow };
    server.use(
      http.get(`${API}/admin/agents/5`, () =>
        HttpResponse.json({ success: true, role: "manager", agent: currentRow }),
      ),
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        const submitted = await request.formData();
        currentRow = {
          ...currentRow,
          num_abonnement: String(submitted.get("num_d_abonnement")),
        };
        return HttpResponse.json({ success: true, message: "ok", data: currentRow });
      }),
    );
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Subscription number"), {
      target: { value: "AB-999" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("AB-999")).toBeInTheDocument();
  });

  it("shows a generic banner on the real 500-validation-swallowed response, and keeps the drawer open", async () => {
    server.use(
      showHandler(5, "manager"),
      http.post(`${API}/admin/agents/5`, () =>
        HttpResponse.json(
          { success: false, message: "Erreur lors de la mise à jour" },
          { status: 500 },
        ),
      ),
    );
    renderPage("/network/agents/5");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
