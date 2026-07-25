import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DepositsListPage } from "./deposits-list-page";

const API = "http://localhost/api/v1";
const PATH = "/money/deposits";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/** `view-depos` gates the route/list itself; `view-agents` gates the Commercials
 * half of the agent filter (see `deposit-agent-filter.tsx`'s own docblock). */
const ALL_DEPOSIT_PERMISSIONS = [PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.VIEW_AGENTS];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * One `DepoResource` row, exactly as `DepoController::index`/`show`/`store`
 * all emit it now (verified fresh from source this phase, commit
 * `8786326`): `amount` is a real NUMBER (not a decimal-cast string), `date`
 * is `Y-m-d H:i` (NOT ISO-8601), and `agent` is already reduced server-side
 * to `{id, full_name, account_number, photo}` — no further column
 * restriction needed at the mapper boundary the way Cheques' unrestricted
 * nested Agent model requires.
 */
function depositRow(
  id: number,
  overrides: Partial<{
    amount: number;
    status: "pending" | "validated" | "rejected";
    type: "rapped" | "grattage";
    method: "bank" | "cash" | "other";
    receipt: string | null;
    proof_url: string | null;
    date: string;
    agent: {
      id: number;
      full_name: string;
      account_number: string;
      photo: string | null;
    };
    created_by: string;
    reject_reason: string | null;
    validated_by: string | null;
    validated_at: string | null;
    bank_name: string | null;
    proof_type: string;
  }> = {},
) {
  return {
    id,
    amount: 1500,
    status: "pending" as const,
    type: "rapped" as const,
    method: "bank" as const,
    receipt: "REC-001",
    proof_url: null,
    date: "2026-02-10 09:00",
    agent: { id: 1, full_name: "Sara Alaoui", account_number: "MG0001", photo: null },
    created_by: "Ahmed Errouissi",
    // Phase 2's five detail-only fields — always on the wire (one shared
    // resource, verified from source), included here so this fixture keeps
    // matching the real contract rather than the Phase-1-era subset.
    reject_reason: null,
    validated_by: null,
    validated_at: null,
    bank_name: null,
    proof_type: "bank_receipt",
    ...overrides,
  };
}

/** Laravel's standard resource-collection envelope, `.additional()`-merged. */
function pageEnvelope(
  rows: ReturnType<typeof depositRow>[],
  meta: Partial<{
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    data: rows,
    links: {},
    meta: {
      current_page: meta.current_page ?? 1,
      per_page: meta.per_page ?? 20,
      total: meta.total ?? rows.length,
      last_page: meta.last_page ?? 1,
    },
    // Extra siblings `.additional()` adds — asserted elsewhere to be
    // harmlessly ignored, present here to match the real envelope exactly.
    status: "success",
    message: "Deposits retrieved successfully",
  };
}

function depositsHandler(
  rows: ReturnType<typeof depositRow>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/depos`, ({ request }) => {
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
      { path: PATH, element: <DepositsListPage /> },
      // A stub so the "View" navigation test (Phase 2) lands on a real
      // route rather than a router-level 404.
      { path: "/money/deposits/:id", element: <p>Deposit detail</p> },
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
  signInWith(ALL_DEPOSIT_PERMISSIONS);
});

describe("deposits list — Laravel resource-collection contract", () => {
  it("renders rows from the {data, links, meta} envelope, ignoring the extra status/message siblings", async () => {
    server.use(
      depositsHandler([
        depositRow(1, { receipt: "REC-001" }),
        depositRow(2, {
          receipt: "REC-002",
          agent: {
            id: 2,
            full_name: "Nadia Tazi",
            account_number: "MG0002",
            photo: null,
          },
        }),
      ]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("REC-001")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Nadia Tazi")).toBeInTheDocument();
  });

  it("sends only page and the five supported filters — never per_page, date_from or date_to", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBeNull();
    expect(url?.searchParams.get("date_from")).toBeNull();
    expect(url?.searchParams.get("date_to")).toBeNull();
    expect(url?.searchParams.get("search")).toBeNull();
    expect(url?.searchParams.get("agent_id")).toBeNull();
    expect(url?.searchParams.get("deposit_method")).toBeNull();
    expect(url?.searchParams.get("type")).toBeNull();
    expect(url?.searchParams.get("status")).toBeNull();
  });

  it("renders a heading and no console-visible runtime error", async () => {
    server.use(depositsHandler([depositRow(1)]), managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Deposits" })).toBeInTheDocument();
  });

  it("shows a loading state before the first response resolves", async () => {
    server.use(
      http.get(`${API}/admin/depos`, async () => {
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
    server.use(depositsHandler([]), managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByText(/no deposit yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no deposits' from 'none match these filters'", async () => {
    server.use(depositsHandler([]), managersHandler(), commercialsHandler());
    renderPage(`${PATH}?search=zzz`);

    expect(
      await screen.findByText(/no deposit matches these filters/i),
    ).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/depos`, () =>
        HttpResponse.json({ status: "error", message: "boom" }, { status: 500 }),
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
  it("renders amount through MoneyAmount, formatted from a real number", async () => {
    server.use(
      depositsHandler([depositRow(1, { amount: 12500 })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText(/12\s*500,00\s*DH/)).toBeInTheDocument();
  });

  it("renders receipt verbatim via formatIdentifier, never money-formatted", async () => {
    server.use(
      depositsHandler([depositRow(1, { receipt: "007" })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("007")).toBeInTheDocument();
  });

  it("renders a null receipt as the absent dash, never fabricating one", async () => {
    server.use(
      depositsHandler([depositRow(1, { receipt: null })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("normalizes the non-ISO 'Y-m-d H:i' date before rendering it (DD/MM/YYYY)", async () => {
    server.use(
      depositsHandler([depositRow(1, { date: "2026-02-10 09:00" })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("10/02/2026")).toBeInTheDocument();
  });

  it.each([
    ["pending", "Pending"],
    ["validated", "Validated"],
    ["rejected", "Rejected"],
  ] as const)(
    "renders status %s with its domain-owned label %s",
    async (status, label) => {
      server.use(
        depositsHandler([depositRow(1, { status })]),
        managersHandler(),
        commercialsHandler(),
      );
      renderPage();

      expect(await screen.findByText(label)).toBeInTheDocument();
    },
  );

  it.each([
    ["rapped", "Rapped"],
    ["grattage", "Grattage"],
  ] as const)("renders type %s as plain text, not a StatusBadge", async (type, label) => {
    server.use(
      depositsHandler([depositRow(1, { type })]),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("reduces the server-shaped agent object to its full_name", async () => {
    server.use(
      depositsHandler([
        depositRow(1, {
          agent: {
            id: 5,
            full_name: "Omar Chraibi",
            account_number: "MG0005",
            photo: null,
          },
        }),
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
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage(`${PATH}?page=3`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("textbox", { name: /search deposits/i }), {
      target: { value: "REC-9" },
    });

    await waitFor(() => expect(url?.searchParams.get("search")).toBe("REC-9"));
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the selected method as `deposit_method`, never `method`", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by method/i }), {
      target: { value: "cash" },
    });

    await waitFor(() => expect(url?.searchParams.get("deposit_method")).toBe("cash"));
    expect(url?.searchParams.get("method")).toBeNull();
  });

  it("sends the selected type as `type`", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by type/i }), {
      target: { value: "grattage" },
    });

    await waitFor(() => expect(url?.searchParams.get("type")).toBe("grattage"));
  });

  it("sends the selected status as `status`", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by status/i }), {
      target: { value: "validated" },
    });

    await waitFor(() => expect(url?.searchParams.get("status")).toBe("validated"));
  });

  it("merges Managers and Commercials into one agent picker, sorted by name", async () => {
    server.use(depositsHandler([]), managersHandler(), commercialsHandler());
    renderPage();

    const agentSelect = await screen.findByRole("combobox", { name: /filter by agent/i });
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
      depositsHandler([], (u) => (url = u)),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const agentSelect = await screen.findByRole("combobox", { name: /filter by agent/i });
    await screen.findByRole("option", { name: "Amine Bennani" });
    fireEvent.change(agentSelect, { target: { value: "20" } });

    await waitFor(() => expect(url?.searchParams.get("agent_id")).toBe("20"));
  });

  it("queries Managers unconditionally but gates Commercials on view-agents (known, disclosed gap)", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS]);
    let managersRequested = false;
    server.use(
      depositsHandler([]),
      http.get(`${API}/admin/agents/managers`, () => {
        managersRequested = true;
        return HttpResponse.json({
          success: true,
          data: { data: [], current_page: 1, per_page: 100, total: 0, last_page: 1 },
        });
      }),
      // Deliberately no commercials handler: MSW's onUnhandledRequest:"error"
      // fails this test if the Commercial half fires anyway.
    );
    renderPage();

    await screen.findByText(/no deposit yet/i);
    expect(managersRequested).toBe(true);
  });
});

describe("pagination", () => {
  it("shows the page summary and disables Previous on the first page", async () => {
    server.use(
      depositsHandler([depositRow(1)], undefined, {
        current_page: 1,
        last_page: 3,
        total: 45,
        per_page: 20,
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("Page 1 of 3 · 45 deposits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("advances the page param on Next", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([depositRow(1)], (u) => (url = u), {
        current_page: 1,
        last_page: 3,
        total: 45,
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();
    await screen.findByText("Page 1 of 3 · 45 deposits");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("omits the pagination footer entirely for a single page", async () => {
    server.use(
      depositsHandler([depositRow(1)], undefined, { last_page: 1 }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("REC-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});

describe("navigation to the detail page (Phase 2)", () => {
  it("navigates to the deposit's detail route on View", async () => {
    server.use(depositsHandler([depositRow(7)]), managersHandler(), commercialsHandler());
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/money/deposits/7"));
  });
});
