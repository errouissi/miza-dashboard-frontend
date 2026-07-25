import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ChequesListPage } from "./cheques-list-page";

const API = "http://localhost/api/v1";
const PATH = "/money/cheques";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/** `view-cheques` gates the route/list itself; `view-agents` gates the Commercials
 * half of the agent filter (see `cheque-agent-filter.tsx`'s own docblock). */
const ALL_CHEQUE_PERMISSIONS = [PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.VIEW_AGENTS];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * One transformed cheque row, exactly as `ChequeController::index`'s `through()`
 * emits it: `amount` is a preformatted decimal STRING (not a number), `statute` is
 * the legacy French status value, and `agent` carries the full nested Agent model
 * (only `id`/`nom`/`prenom` are read at the mapper boundary — see `cheques-api.ts`).
 */
function chequeRow(
  id: number,
  numCheque: string,
  overrides: Partial<{
    amount: string;
    agent_id: number;
    decision_reason: string | null;
    processed_at: string | null;
    created_at: string;
    statute: "en_attente" | "accepter" | "rejetee" | "annuler";
    photo_url: string | null;
    agent: { id: number; nom: string; prenom: string };
  }> = {},
) {
  return {
    id,
    amount: "1500.00",
    num_cheque: numCheque,
    agent_id: 1,
    decision_reason: null,
    processed_at: null,
    created_at: "2026-02-10T09:00:00Z",
    statute: "en_attente" as const,
    photo_url: null,
    agent: { id: 1, nom: "Alaoui", prenom: "Sara" },
    ...overrides,
  };
}

/** The flat-paginator envelope: `{ success, data: { data: [...], current_page, … } }`. */
function pageEnvelope(
  rows: ReturnType<typeof chequeRow>[],
  meta: Partial<{
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    success: true,
    data: {
      data: rows,
      current_page: meta.current_page ?? 1,
      per_page: meta.per_page ?? 15,
      total: meta.total ?? rows.length,
      last_page: meta.last_page ?? 1,
    },
  };
}

function chequesHandler(
  rows: ReturnType<typeof chequeRow>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/cheques`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows, meta));
  });
}

/** The Managers options endpoint, backing the merged agent filter's Manager half. */
function managersHandler(onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/agents/managers`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 10,
            nom: "Idrissi",
            prenom: "Youssef",
            status: "active",
            num_abonnement: null,
            num_de_compte: "MG0010",
            avance_total: "0.00",
            ville: null,
            ville_sous_responsabilite: null,
            nombre_commerciaux: 0,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    });
  });
}

/** The Commercials options endpoint, backing the merged agent filter's Commercial half. */
function commercialsHandler(onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/agents/commercials`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 20,
            nom: "Bennani",
            prenom: "Amine",
            status: "active",
            num_abonnement: null,
            num_de_compte: "CM0020",
            avance_total: "0.00",
            ville_actuelle: null,
            manager: null,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    });
  });
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <ChequesListPage /> },
      // A stub so the "View" navigation test (Phase 3B) lands on a real
      // route rather than a router-level 404.
      { path: "/money/cheques/:id", element: <p>Cheque detail</p> },
    ],
    { initialEntries: [initialPath] },
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
  signInWith(ALL_CHEQUE_PERMISSIONS);
});

describe("cheques list — flat-paginator contract", () => {
  it("renders rows from the { success, data: <paginator> } envelope", async () => {
    server.use(
      chequesHandler([
        chequeRow(1, "CHQ-001"),
        chequeRow(2, "CHQ-002", { agent: { id: 2, nom: "Tazi", prenom: "Nadia" } }),
      ]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("CHQ-001")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Nadia Tazi")).toBeInTheDocument();
  });

  it("sends page and per_page, and omits every unset filter", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("15");
    expect(url?.searchParams.get("statute")).toBeNull();
    expect(url?.searchParams.get("agent_id")).toBeNull();
    expect(url?.searchParams.get("search")).toBeNull();
    expect(url?.searchParams.get("date_from")).toBeNull();
    expect(url?.searchParams.get("date_to")).toBeNull();
  });

  it("renders a heading and no console-visible runtime error", async () => {
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001")]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Cheques" })).toBeInTheDocument();
  });

  it("shows a loading state before the first response resolves", async () => {
    server.use(
      http.get(`${API}/admin/cheques`, async () => {
        await delay(30);
        return HttpResponse.json(pageEnvelope([]));
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(chequesHandler([]), managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByText(/no cheque yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no cheques' from 'none match these filters'", async () => {
    server.use(chequesHandler([]), managersHandler(), commercialsHandler());
    renderPage(`${PATH}?search=zzz`);

    expect(
      await screen.findByText(/no cheque matches these filters/i),
    ).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/cheques`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("mapping the transformed row", () => {
  it("renders amount verbatim as the backend's preformatted string, never reformatted", async () => {
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001", { amount: "1234.56" })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    // Not through MoneyAmount: a parse-and-reformat round trip would put a
    // decimal-cast backend value through binary floating point for nothing.
    expect(await screen.findByText("1234.56")).toBeInTheDocument();
  });

  it("renders num_cheque verbatim via formatIdentifier, never money-formatted", async () => {
    server.use(
      chequesHandler([chequeRow(1, "007")]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    // formatIdentifier never inserts separators or trims leading zeros.
    expect(await screen.findByText("007")).toBeInTheDocument();
  });

  it("renders created_at through the shared date formatter (DD/MM/YYYY)", async () => {
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001", { created_at: "2026-02-10T09:00:00Z" })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("10/02/2026")).toBeInTheDocument();
  });

  it.each([
    ["en_attente", "Pending"],
    ["accepter", "Approved"],
    ["rejetee", "Rejected"],
    ["annuler", "Cancelled"],
  ] as const)(
    "renders status %s with its domain-owned label %s",
    async (statute, label) => {
      server.use(
        chequesHandler([chequeRow(1, "CHQ-001", { statute })]),
        managersHandler(),
        commercialsHandler(),
      );
      renderPage();

      expect(await screen.findByText(label)).toBeInTheDocument();
    },
  );

  it("reduces the nested agent relation to a '{prenom} {nom}' display name", async () => {
    server.use(
      chequesHandler([
        chequeRow(1, "CHQ-001", { agent: { id: 5, nom: "Chraibi", prenom: "Omar" } }),
      ]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("Omar Chraibi")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("sends the search term as `search`, resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage(`${PATH}?page=3`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("textbox", { name: /search cheques/i }), {
      target: { value: "CHQ-9" },
    });

    await waitFor(() => expect(url?.searchParams.get("search")).toBe("CHQ-9"));
    // page reset to the default (1), which is omitted from both the URL and the request.
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the selected status as `statute`, never `status`", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by status/i }), {
      target: { value: "accepter" },
    });

    await waitFor(() => expect(url?.searchParams.get("statute")).toBe("accepter"));
    expect(url?.searchParams.get("status")).toBeNull();
  });

  it("merges Managers and Commercials into one agent picker, sorted by name", async () => {
    server.use(chequesHandler([]), managersHandler(), commercialsHandler());
    renderPage();

    const agentSelect = await screen.findByRole("combobox", { name: /filter by agent/i });
    // The select renders immediately; its options arrive once the two picker
    // queries resolve, so assert against the settled state, not the first paint.
    await waitFor(() =>
      expect(
        within(agentSelect)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["All agents", "Amine Bennani", "Youssef Idrissi"]),
    );
  });

  it("sends the selected agent as `agent_id`", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const agentSelect = await screen.findByRole("combobox", { name: /filter by agent/i });
    // Wait for the real option to exist before selecting it — a native <select>
    // ignores fireEvent.change to a value with no matching <option> yet.
    await screen.findByRole("option", { name: "Amine Bennani" });
    fireEvent.change(agentSelect, { target: { value: "20" } });

    await waitFor(() => expect(url?.searchParams.get("agent_id")).toBe("20"));
  });

  it("sends date_from and date_to from the submitted-date range", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByLabelText(/submitted from/i), {
      target: { value: "2026-01-01" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_from")).toBe("2026-01-01"));

    fireEvent.change(screen.getByLabelText(/submitted before/i), {
      target: { value: "2026-01-31" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_to")).toBe("2026-01-31"));
  });

  it("queries Managers unconditionally but gates Commercials on view-agents (known, disclosed gap)", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES]);
    let managersRequested = false;
    server.use(
      chequesHandler([]),
      http.get(`${API}/admin/agents/managers`, () => {
        managersRequested = true;
        return HttpResponse.json({
          success: true,
          data: { data: [], current_page: 1, per_page: 100, total: 0, last_page: 1 },
        });
      }),
      // Deliberately no commercials handler: MSW's onUnhandledRequest:"error" fails
      // this test if the Commercial half fires anyway, which is the assertion.
    );
    renderPage();

    await screen.findByText(/no cheque yet/i);
    expect(managersRequested).toBe(true);
  });
});

describe("navigation to the detail page (Phase 3B)", () => {
  it("navigates to the cheque's detail route on View", async () => {
    server.use(
      chequesHandler([chequeRow(7, "CHQ-007")]),
      managersHandler(),
      commercialsHandler(),
    );
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/money/cheques/7"));
  });
});

describe("pagination", () => {
  it("shows the page summary and disables Previous on the first page", async () => {
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001")], undefined, {
        current_page: 1,
        last_page: 3,
        total: 45,
        per_page: 15,
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("Page 1 of 3 · 45 cheques")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("advances the page param on Next", async () => {
    let url: URL | undefined;
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001")], (u) => (url = u), {
        current_page: 1,
        last_page: 3,
        total: 45,
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await screen.findByText("Page 1 of 3 · 45 cheques");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("omits the pagination footer entirely for a single page", async () => {
    server.use(
      chequesHandler([chequeRow(1, "CHQ-001")], undefined, { last_page: 1 }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("CHQ-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
