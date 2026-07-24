import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { httpClient } from "@/infrastructure/http";
import { AppError } from "@/infrastructure/errors";
import { AgentOnboardingWizardPage } from "./agent-onboarding-wizard-page";

/**
 * The submission tests below mock `httpClient.post` directly, NOT MSW.
 * Verified empirically (a throwaway repro, since deleted): in this
 * jsdom + MSW test environment, a request whose body is a `FormData`
 * containing a real `File` hangs indefinitely during interception —
 * reproduced even bypassing axios entirely with a raw `fetch()` call, so
 * this is a jsdom/MSW environment limitation, not a defect in
 * `createAgent`/`httpClient`. A `FormData` WITHOUT a `File` intercepts
 * fine. Every other test file in this product posts plain JSON and is
 * unaffected — this is the first multipart request in the codebase.
 * Mocking `httpClient.post` exercises the exact same call this component
 * makes without asking the test environment to serialize a `File` across
 * a mocked network boundary.
 */

const API = "http://localhost/api/v1";
const PATH = "/network/agents/onboard";

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

/** The manager picker's own endpoint — always queried unconditionally by `useManagerOptionsQuery`. */
function managersHandler() {
  return http.get(`${API}/admin/agents/managers`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 635,
            nom: "Bennani",
            prenom: "Youssef",
            status: "active",
            num_abonnement: null,
            num_de_compte: "MG00001",
            avance_total: "0.00",
            app_version: null,
            ville: "Casablanca",
            ville_sous_responsabilite: "Casablanca",
            nombre_commerciaux: 1,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

/**
 * The Villes options endpoint, backing the Identity step's City selects —
 * gated on `access-dashboard`, granted by default in `beforeEach` below
 * (found during M3.6's manual-validation review: City became a select,
 * matching Managers'/Commercials' own edit forms, so every test that fills
 * Identity now needs an option to select).
 */
function villesHandler() {
  return http.get(`${API}/admin/villes`, () =>
    HttpResponse.json({
      data: [
        { id: 1, nom_ville: "Casablanca" },
        { id: 2, nom_ville: "Rabat" },
      ],
      links: {},
      meta: { current_page: 1, per_page: 100, total: 2, last_page: 1 },
    }),
  );
}

/**
 * The Secteurs options endpoint, scoped by `ville_id` — backs the Identity
 * step's Sector select for the commercial role. Casablanca (villesHandler's
 * id 1) has two secteurs; Rabat (id 2) has none, which is enough to exercise
 * "sector options depend on the selected city" honestly, not just by name.
 */
function secteursHandler() {
  return http.get(`${API}/admin/secteurs`, ({ request }) => {
    const villeId = new URL(request.url).searchParams.get("ville_id");
    const rows =
      villeId === "1"
        ? [
            { id: 10, nom_secteur: "Maarif", ville_id: 1 },
            { id: 11, nom_secteur: "Sidi Belyout", ville_id: 1 },
          ]
        : [];
    return HttpResponse.json(rows);
  });
}

const CREATE_AGENT_ENVELOPE = {
  success: true,
  message: "Agent créé avec succès",
  data: {
    agent: {
      id: 900,
      nom: "Alami",
      prenom: "Youssef",
      role: "manager",
      num_compte: "MG00007",
    },
    credentials: { num_de_compte: "MG00007", password: "aB3xK9pQ" },
  },
};

function renderWizard(initialPath: string = `${PATH}?role=manager`) {
  const router = createMemoryRouter(
    [{ path: PATH, element: <AgentOnboardingWizardPage /> }],
    {
      initialEntries: [initialPath],
    },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const validImage = (name = "photo.jpg") => new File(["x"], name, { type: "image/jpeg" });
const validDoc = (name = "doc.pdf") => new File(["x"], name, { type: "application/pdf" });

function uploadFile(label: string | RegExp, file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
}

async function fillIdentity() {
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Alami" } });
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Youssef" } });
  // The City select's options load from Villes asynchronously — wait for the
  // real option before selecting it, rather than setting a value with no
  // matching <option> yet in the DOM. Scoped to the City select specifically:
  // under the commercial role, "Current city" also offers a "Casablanca"
  // option, which would make an unscoped query ambiguous.
  await within(screen.getByLabelText("City")).findByRole("option", {
    name: "Casablanca",
  });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Casablanca" } });
  fireEvent.change(screen.getByLabelText("Address"), {
    target: { value: "12 Rue Test" },
  });
  fireEvent.change(screen.getByLabelText("CIN number"), {
    target: { value: "AB123456" },
  });
  fireEvent.change(screen.getByLabelText("ICE number"), {
    target: { value: "0012345678" },
  });
}

function fillDocuments() {
  uploadFile("Photo", validImage("photo.jpg"));
  uploadFile("CIN — front", validImage("cin-recto.jpg"));
  uploadFile("CIN — back", validImage("cin-verso.jpg"));
  uploadFile("Habitat certificate", validDoc("certificat.pdf"));
  uploadFile("Auto-entrepreneur card", validDoc("carte.pdf"));
}

function fillFinancial() {
  fireEvent.change(screen.getByLabelText("Phone Subscription Number"), {
    target: { value: "0612345678" },
  });
  fireEvent.change(screen.getByLabelText("Salary (MAD, whole numbers)"), {
    target: { value: "5000" },
  });
  fireEvent.change(screen.getByLabelText("CNSS declared amount (MAD, whole numbers)"), {
    target: { value: "1000" },
  });
  fireEvent.change(
    screen.getByLabelText("Auto-entrepreneur charge (MAD, whole numbers)"),
    {
      target: { value: "200" },
    },
  );
}

// `goNext` awaits `form.trigger(...)`; every caller follows this with an
// async `findBy*` for the next step's own marker, which is what actually
// waits out the async validation — this helper just fires the click.
function clickNext() {
  fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
}

/** Fills Identity → Documents → Financial and lands on Moto, the default no-op step. */
async function reachMotoStep() {
  await fillIdentity();
  clickNext();
  await screen.findByLabelText("Photo");
  fillDocuments();
  clickNext();
  await screen.findByLabelText("Phone Subscription Number");
  fillFinancial();
  clickNext();
  await screen.findByText(/this agent has a motorcycle/i);
}

/** Fills every step and lands on Review, moto left off (the default). */
async function reachReviewStep() {
  await reachMotoStep();
  clickNext();
  await screen.findByRole("button", { name: /^confirm and create agent$/i });
}

beforeEach(() => {
  window.localStorage.clear();
  // ACCESS_DASHBOARD is what gates GET /admin/villes, backing the Identity
  // step's City selects — granted here so every test can resolve them.
  signInWith([
    PERMISSIONS.CREATE_AGENT,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.ACCESS_DASHBOARD,
  ]);
});

describe("permission gating", () => {
  it("renders the wizard for an operator holding create-agent", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    expect(
      await screen.findByRole("heading", { name: /onboard an agent/i }),
    ).toBeInTheDocument();
  });
});

describe("wizard navigation", () => {
  it("preselects the role from the query string", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard(`${PATH}?role=commercial`);

    await screen.findByRole("heading", { name: /onboard an agent/i });
    expect(screen.getByLabelText("Commercial")).toBeChecked();
    expect(screen.getByLabelText("Manager")).not.toBeChecked();
  });

  it("defaults to manager when the role query param is missing or invalid", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard(PATH);

    await screen.findByRole("heading", { name: /onboard an agent/i });
    expect(screen.getByLabelText("Manager")).toBeChecked();
  });

  it("advances through every step to Review when each step is valid", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    expect(screen.getByText(/review everything below/i)).toBeInTheDocument();
  });

  it("never shows a submit button before the Review step", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await screen.findByLabelText("Last name");
    expect(
      screen.queryByRole("button", { name: /^confirm and create agent$/i }),
    ).not.toBeInTheDocument();
  });
});

describe("step validation blocks Next", () => {
  it("blocks leaving Identity when required fields are empty", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await screen.findByLabelText("Last name");
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/last name is required/i)).toBeInTheDocument();
    // Still on Identity — Documents' own field never appears.
    expect(screen.queryByLabelText("Photo")).not.toBeInTheDocument();
  });

  it("blocks leaving Documents when a required file is missing", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    // All five required file fields are empty — several errors render.
    expect((await screen.findAllByText(/this file is required/i)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByLabelText("Phone Subscription Number")).not.toBeInTheDocument();
  });
});

describe("phone subscription number validation", () => {
  it("rejects a value that is not a valid Moroccan phone number", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");
    fillDocuments();
    clickNext();
    await screen.findByLabelText("Phone Subscription Number");

    fireEvent.change(screen.getByLabelText("Phone Subscription Number"), {
      target: { value: "SUB-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(
      await screen.findByText(/enter a valid moroccan phone number/i),
    ).toBeInTheDocument();
    // Still on Financial — Moto's own marker never appears.
    expect(screen.queryByText(/this agent has a motorcycle/i)).not.toBeInTheDocument();
  });

  it("accepts a valid Moroccan phone number", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");
    fillDocuments();
    clickNext();
    await screen.findByLabelText("Phone Subscription Number");
    fillFinancial();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/this agent has a motorcycle/i)).toBeInTheDocument();
  });
});

describe("back navigation preserves entered values", () => {
  it("keeps Identity's values after advancing and returning", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(await screen.findByLabelText("Last name")).toHaveValue("Alami");
    expect(screen.getByLabelText("First name")).toHaveValue("Youssef");
    expect(screen.getByLabelText("City")).toHaveValue("Casablanca");
  });

  it("keeps a chosen file across a Back/Next round trip", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");
    fillDocuments();

    clickNext();
    await screen.findByLabelText("Phone Subscription Number");
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    expect(await screen.findByText("photo.jpg")).toBeInTheDocument();
  });
});

describe("role switching", () => {
  it("swaps role-specific fields when the role radio changes", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard(`${PATH}?role=manager`);

    await screen.findByLabelText(/area of responsibility/i);
    expect(screen.queryByLabelText(/manager \(optional\)/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Commercial"));

    expect(await screen.findByLabelText(/manager \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current city/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/area of responsibility/i)).not.toBeInTheDocument();
  });
});

describe("commercial role — city-scoped sector select", () => {
  it("disables the sector select until a city is chosen, then scopes options to it", async () => {
    server.use(managersHandler(), villesHandler(), secteursHandler());
    renderWizard(`${PATH}?role=commercial`);

    const cityField = await screen.findByLabelText(/current city/i);
    expect(screen.getByLabelText(/sector/i)).toBeDisabled();

    // Scoped to the "Current city" select specifically — under the
    // commercial role, "City" also offers a "Casablanca" option, which
    // would make an unscoped query ambiguous.
    await within(cityField).findByRole("option", { name: "Casablanca" });
    fireEvent.change(cityField, { target: { value: "Casablanca" } });

    await waitFor(() => expect(screen.getByLabelText(/sector/i)).not.toBeDisabled());
    expect(await screen.findByRole("option", { name: "Maarif" })).toBeInTheDocument();
  });

  it("clears the selected sector and reloads options when the city changes", async () => {
    server.use(managersHandler(), villesHandler(), secteursHandler());
    renderWizard(`${PATH}?role=commercial`);

    const cityField = screen.getByLabelText(/current city/i);
    await within(cityField).findByRole("option", { name: "Casablanca" });
    fireEvent.change(cityField, { target: { value: "Casablanca" } });
    await screen.findByRole("option", { name: "Maarif" });
    fireEvent.change(screen.getByLabelText(/sector/i), { target: { value: "Maarif" } });
    expect(screen.getByLabelText(/sector/i)).toHaveValue("Maarif");

    // Rabat has no seeded secteurs — the select stays enabled (a city IS
    // selected) but offers only the placeholder, and the stale "Maarif"
    // selection (which belongs to Casablanca) must not survive the change.
    fireEvent.change(screen.getByLabelText(/current city/i), {
      target: { value: "Rabat" },
    });

    await waitFor(() => expect(screen.getByLabelText(/sector/i)).toHaveValue(""));
    expect(screen.queryByRole("option", { name: "Maarif" })).not.toBeInTheDocument();
  });

  it("submits the sector's name, unchanged, exactly as the free-text field used to", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler(), secteursHandler());
    renderWizard(`${PATH}?role=commercial`);

    await fillIdentity();
    fireEvent.change(screen.getByLabelText(/current city/i), {
      target: { value: "Casablanca" },
    });
    await screen.findByRole("option", { name: "Maarif" });
    fireEvent.change(screen.getByLabelText(/sector/i), {
      target: { value: "Maarif" },
    });
    clickNext();
    await screen.findByLabelText("Photo");
    fillDocuments();
    clickNext();
    await screen.findByLabelText("Phone Subscription Number");
    fillFinancial();
    clickNext();
    await screen.findByText(/this agent has a motorcycle/i);
    clickNext();
    await screen.findByRole("button", { name: /^confirm and create agent$/i });

    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(body.get("role")).toBe("commercial");
    expect(body.get("secteur")).toBe("Maarif");
  });
});

describe("moto conditional logic", () => {
  it("shows no moto fields until the checkbox is checked", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    expect(screen.queryByLabelText("Chassis number")).not.toBeInTheDocument();
  });

  it("reveals moto fields once checked, and Next is blocked until they're filled", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    fireEvent.click(screen.getByLabelText(/this agent has a motorcycle/i));

    expect(await screen.findByLabelText("Chassis number")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/motorcycle type is required/i)).toBeInTheDocument();
  });

  it("shows the fuel amount field only for a gas motorcycle", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    expect(screen.queryByLabelText("Fuel amount (MAD)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/this agent has a motorcycle/i));
    // Checked, but no type picked yet — still hidden.
    expect(screen.queryByLabelText("Fuel amount (MAD)")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByLabelText("Electric"));
    expect(screen.queryByLabelText("Fuel amount (MAD)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Gas"));
    expect(await screen.findByLabelText("Fuel amount (MAD)")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Electric"));
    expect(screen.queryByLabelText("Fuel amount (MAD)")).not.toBeInTheDocument();
  });

  it("submits the fuel amount entered while a gas motorcycle was selected", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    fireEvent.click(screen.getByLabelText(/this agent has a motorcycle/i));
    fireEvent.click(await screen.findByLabelText("Gas"));
    fireEvent.change(await screen.findByLabelText("Fuel amount (MAD)"), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByLabelText("Chassis number"), {
      target: { value: "CH123" },
    });
    uploadFile("Registration card — front", validDoc());
    uploadFile("Registration card — back", validDoc());
    uploadFile("Insurance", validDoc());
    uploadFile("Engagement letter", validDoc());
    clickNext();
    await screen.findByRole("button", { name: /^confirm and create agent$/i });

    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(body.get("montant_essence")).toBe("150");
  });

  it("resets the fuel amount to 0 when switching away from a gas motorcycle before submitting", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    fireEvent.click(screen.getByLabelText(/this agent has a motorcycle/i));
    fireEvent.click(await screen.findByLabelText("Gas"));
    fireEvent.change(await screen.findByLabelText("Fuel amount (MAD)"), {
      target: { value: "150" },
    });
    // Switching to Electric hides the field AND zeroes the value it held.
    fireEvent.click(screen.getByLabelText("Electric"));
    fireEvent.change(screen.getByLabelText("Chassis number"), {
      target: { value: "CH123" },
    });
    uploadFile("Registration card — front", validDoc());
    uploadFile("Registration card — back", validDoc());
    uploadFile("Insurance", validDoc());
    uploadFile("Engagement letter", validDoc());
    clickNext();
    await screen.findByRole("button", { name: /^confirm and create agent$/i });

    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(body.get("montant_essence")).toBe("0");
  });
});

describe("file validation", () => {
  it("rejects an oversized file client-side", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");

    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    uploadFile("Photo", big);
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/file must be 2mb or smaller/i)).toBeInTheDocument();
  });

  it("rejects an unsupported file type client-side", async () => {
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await fillIdentity();
    clickNext();
    await screen.findByLabelText("Photo");

    const wrongType = new File(["x"], "photo.gif", { type: "image/gif" });
    uploadFile("Photo", wrongType);
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
  });
});

/**
 * Regression coverage for a real bug found during manual validation:
 * reaching Review used to auto-submit. Root cause was a `type="submit"`
 * button sharing the exact same JSX slot as the `type="button"` Next
 * button — see the module docblock in `agent-onboarding-wizard-page.tsx`.
 * These tests prove the fix at the API-call boundary, not just the button's
 * `type` attribute, so a regression that reintroduces an equivalent bug by
 * a different mechanism (an effect, a different shared DOM node, …) is
 * still caught.
 */
describe("Review does not auto-submit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call the API when moving from Motorcycle to Review", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachMotoStep();
    clickNext();

    await screen.findByText(/review everything below/i);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("does not call the API merely by having Review rendered", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    // One more tick, in case a delayed effect (not just the transition
    // itself) were the trigger — proves silence, not just a lucky timing.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(postSpy).not.toHaveBeenCalled();
  });

  it("does not call the API when clicking Back from Review", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    await screen.findByText(/this agent has a motorcycle/i);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("calls the API exactly once when Confirm and Create Agent is clicked", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
  });

  it("does not send a duplicate request when Confirm is clicked repeatedly while pending", async () => {
    let resolvePost:
      ((value: { data: typeof CREATE_AGENT_ENVELOPE }) => void) | undefined;
    const postSpy = vi.spyOn(httpClient, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    const confirmButton = screen.getByRole("button", {
      name: /^confirm and create agent$/i,
    });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(postSpy).toHaveBeenCalledTimes(1);

    resolvePost?.({ data: CREATE_AGENT_ENVELOPE });
    expect(
      await screen.findByRole("heading", { name: /agent created/i }),
    ).toBeInTheDocument();
  });
});

describe("submission — FormData payload and success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a multipart request with the exact wire field names", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(url).toBe("/admin/agents");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("role")).toBe("manager");
    expect(body.get("nom")).toBe("Alami");
    expect(body.get("prenom")).toBe("Youssef");
    expect(body.get("num_cin")).toBe("AB123456");
    expect(body.get("num_d_abonnement")).toBe("0612345678");
    expect(body.get("montant_essence")).toBe("0");
    expect(body.get("has_moto")).toBe("false");
    // Manager role: no commercial-only fields sent.
    expect(body.get("manager_id")).toBeNull();
    // File fields ride as real File entries, not strings.
    expect(body.get("photo")).toBeInstanceOf(File);
  });

  it("shows the success screen with the generated account number and password", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    expect(
      await screen.findByRole("heading", { name: /agent created/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("MG00007")).toBeInTheDocument();
    expect(screen.getByText("aB3xK9pQ")).toBeInTheDocument();
    expect(
      screen.getByText(/shown only once and cannot be retrieved later/i),
    ).toBeInTheDocument();
  });

  it("resets to a fresh wizard on 'Onboard another agent'", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));
    await screen.findByRole("heading", { name: /agent created/i });

    fireEvent.click(screen.getByRole("button", { name: /onboard another agent/i }));

    expect(await screen.findByLabelText("Last name")).toHaveValue("");
  });
});

describe("failed submission preserves every entered value", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the Review step and all data intact after a 500, and a retry can still succeed", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockRejectedValueOnce(
        new AppError({ kind: "server", status: 500, message: "boom" }),
      )
      .mockResolvedValueOnce({ data: CREATE_AGENT_ENVELOPE });
    server.use(managersHandler(), villesHandler());
    renderWizard();

    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      /nothing you entered has been lost/i,
    );
    // Still on Review — the summary still reflects everything entered.
    expect(screen.getByText(/review everything below/i)).toBeInTheDocument();
    expect(screen.getByText("Youssef Alami")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^confirm and create agent$/i }));

    expect(
      await screen.findByRole("heading", { name: /agent created/i }),
    ).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledTimes(2);
  });
});
