import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { CommercialsListPage } from "./commercials-list-page";

const API = "http://localhost/api/v1";
const PATH = "/network/commercials";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/** Every agent permission this screen consumes — the fully-privileged operator. */
const ALL_AGENT_PERMISSIONS = [
  PERMISSIONS.ACCESS_DASHBOARD, // for the ville filter's options query
  PERMISSIONS.VIEW_AGENTS,
  PERMISSIONS.UPDATE_AGENT,
  PERMISSIONS.BLOCK_AGENT,
  PERMISSIONS.ACTIVATE_AGENT,
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * One transformed commercial row, exactly as `indexCommercials`' `transform()`
 * emits it: `avance_total` is a preformatted STRING, `date_debut` is a bare
 * `Y-M-D`, `photo_path` is an absolute URL, `manager` is a CONCATENATED
 * DISPLAY STRING (never a relation object, never a raw id) — and there is no
 * `secteur` field at all, despite the filter accepting one (deferred by
 * decision). `app_version` rides along unmapped.
 */
function row(
  id: number,
  prenom: string,
  nom: string,
  overrides: Partial<{
    status: "active" | "blocked" | "inactive";
    num_abonnement: string | null;
    num_de_compte: string;
    avance_total: string;
    ville_actuelle: string | null;
    manager: string | null;
    date_debut: string | null;
    photo_path: string | null;
  }> = {},
) {
  return {
    id,
    nom,
    prenom,
    status: "active" as const,
    num_abonnement: `AB-${id}`,
    num_de_compte: `CM000${id}`,
    avance_total: "500.00",
    app_version: "1.4.2",
    ville_actuelle: "Casablanca",
    manager: "Bennani Youssef",
    date_debut: "2026-02-10",
    photo_path: null,
    ...overrides,
  };
}

/**
 * The flat-paginator envelope: `{ success, data: { data: [...], current_page, … } }`.
 * Identical shape to Managers, verified independently against the live endpoint.
 */
function pageEnvelope(
  rows: ReturnType<typeof row>[],
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

function commercialsHandler(
  rows: ReturnType<typeof row>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/agents/commercials`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows, meta));
  });
}

/** The Villes options endpoint, backing the current-city filter. Paginated envelope. */
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
 * The Managers list endpoint, backing the manager filter's options query
 * (`useManagerOptionsQuery`, read from Managers' public surface). Same
 * flat-paginator envelope as Commercials' own list — it is the same endpoint.
 */
function managersOptionsHandler() {
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
          {
            id: 640,
            nom: "Idrissi",
            prenom: "Karim",
            status: "active",
            num_abonnement: null,
            num_de_compte: "MG00002",
            avance_total: "0.00",
            app_version: null,
            ville: "Rabat",
            ville_sous_responsabilite: null,
            nombre_commerciaux: 0,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 2,
        last_page: 1,
      },
    }),
  );
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter([{ path: PATH, element: <CommercialsListPage /> }], {
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

describe("commercials list — flat-paginator contract", () => {
  it("renders rows from the { success, data: <paginator> } envelope", async () => {
    server.use(
      commercialsHandler([
        row(1, "Salma", "Alaoui"),
        row(2, "Karim", "Fassi", { num_de_compte: "CM0002" }),
      ]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    expect(await screen.findByText("Salma Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Karim Fassi")).toBeInTheDocument();
    expect(screen.getByText("CM0002")).toBeInTheDocument();
  });

  it("sends page and per_page, and no sort parameter", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("15");
    // The endpoint accepts no sort of any kind (BC-L) — none must be sent.
    expect(url?.searchParams.get("sort")).toBeNull();
    expect(url?.searchParams.get("direction")).toBeNull();
    expect(url?.searchParams.get("sort_by")).toBeNull();
  });

  it("renders no sortable header", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryByRole("button", { name: "Commercial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Joined" })).not.toBeInTheDocument();
  });

  it("renders no link to a detail page anywhere in the list", async () => {
    // No detail page exists this milestone (ADR-0014) — a row must not link
    // anywhere, and no action must resemble navigation to one.
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows a loading state before the first response arrives", async () => {
    // ListLoadingState renders skeleton rows under aria-busy="true" — no
    // accessible role or text of its own (Design System §21: never a
    // spinner), so it is queried by that attribute rather than by role.
    let resolveRequest: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    server.use(
      http.get(`${API}/admin/agents/commercials`, async () => {
        await pending;
        return HttpResponse.json(pageEnvelope([row(1, "Salma", "Alaoui")]));
      }),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument(),
    );
    resolveRequest?.();
    await screen.findByText("Salma Alaoui");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(commercialsHandler([]), villesHandler(), managersOptionsHandler());
    renderPage();

    expect(await screen.findByText(/no commercial yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no commercials' from 'none match these filters'", async () => {
    server.use(commercialsHandler([]), villesHandler(), managersOptionsHandler());
    renderPage(`${PATH}?search=zzz`);

    expect(
      await screen.findByText(/no commercial matches these filters/i),
    ).toBeInTheDocument();
  });
});

describe("mapping the transformed row", () => {
  it("renders avance_total verbatim as the backend's preformatted string", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { avance_total: "789.10" })]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    expect(await screen.findByText("789.10")).toBeInTheDocument();
  });

  it("renders the manager as the backend's concatenated display string", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { manager: "Idrissi Karim" })]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("Salma Alaoui")).closest("tr")!;
    expect(within(tr).getByText("Idrissi Karim")).toBeInTheDocument();
  });

  it("renders date_debut through the shared date formatter (DD/MM/YYYY)", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { date_debut: "2026-02-10" })]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    expect(await screen.findByText("10/02/2026")).toBeInTheDocument();
  });

  it("renders the absent dash for null num_abonnement, null ville_actuelle, null manager and null date_debut", async () => {
    // The load-bearing nullability case: num_abonnement and ville_actuelle are
    // BOTH nullable server-side (confirmed live during M3.3 planning), and
    // must never be passed through as a bare null. This is the exact defect
    // Managers shipped and then fixed live — verified absent here from the
    // first draft.
    server.use(
      commercialsHandler([
        row(1, "Salma", "Alaoui", {
          num_abonnement: null,
          ville_actuelle: null,
          manager: null,
          date_debut: null,
        }),
      ]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("Salma Alaoui")).closest("tr")!;
    // Four absent cells: subscription, current city, manager, joined date.
    expect(within(tr).getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("does not render app_version — it is intentionally unmapped", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryByText("1.4.2")).not.toBeInTheDocument();
  });

  it("never renders a secteur filter or column — deferred by decision", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryByLabelText(/secteur/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secteur/i)).not.toBeInTheDocument();
  });
});

describe("status rendering — a three-value enum, labelled locally", () => {
  it("labels each status without a shared badge", async () => {
    server.use(
      commercialsHandler([
        row(1, "Active", "One", { status: "active" }),
        row(2, "Blocked", "Two", { status: "blocked" }),
        row(3, "Inactive", "Three", { status: "inactive" }),
      ]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const activeRow = (await screen.findByText("Active One")).closest("tr")!;
    const blockedRow = screen.getByText("Blocked Two").closest("tr")!;
    const inactiveRow = screen.getByText("Inactive Three").closest("tr")!;

    expect(within(activeRow).getByText("Active")).toBeInTheDocument();
    expect(within(blockedRow).getByText("Blocked")).toBeInTheDocument();
    expect(within(inactiveRow).getByText("Inactive")).toBeInTheDocument();
  });
});

describe("search — a real backend parameter", () => {
  it("sends the term as `search` and resets to page 1", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage(`${PATH}?page=3`);

    await screen.findByText("Salma Alaoui");
    fireEvent.change(screen.getByLabelText(/search commercials/i), {
      target: { value: "Fassi" },
    });

    await waitFor(() => expect(url?.searchParams.get("search")).toBe("Fassi"));
    expect(url?.searchParams.get("page")).toBe("1");
  });
});

describe("filters — every supported one, and only those", () => {
  it("sends status", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: "blocked" },
    });

    await waitFor(() => expect(url?.searchParams.get("status")).toBe("blocked"));
  });

  it("sends ville_actuelle as an EXACT value chosen from the city select", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const citySelect = await screen.findByLabelText(/filter by current city/i);
    await within(citySelect).findByRole("option", { name: "Rabat" });
    fireEvent.change(citySelect, { target: { value: "Rabat" } });

    await waitFor(() => expect(url?.searchParams.get("ville_actuelle")).toBe("Rabat"));
  });

  it("sends manager_id as the real manager's numeric id, from the manager select", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const managerSelect = await screen.findByLabelText(/filter by manager/i);
    await within(managerSelect).findByRole("option", { name: "Karim Idrissi" });
    fireEvent.change(managerSelect, { target: { value: "640" } });

    await waitFor(() => expect(url?.searchParams.get("manager_id")).toBe("640"));
  });

  it("sends date_from and date_to", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/joined from/i), {
      target: { value: "2026-01-01" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_from")).toBe("2026-01-01"));

    fireEvent.change(screen.getByLabelText(/joined before/i), {
      target: { value: "2026-06-30" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_to")).toBe("2026-06-30"));
  });

  it("reads filters back out of the URL on load", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage(`${PATH}?status=inactive&ville_actuelle=Rabat&manager_id=640&search=Sara`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("inactive");
    expect(url?.searchParams.get("ville_actuelle")).toBe("Rabat");
    expect(url?.searchParams.get("manager_id")).toBe("640");
    expect(url?.searchParams.get("search")).toBe("Sara");
  });

  it("rejects a hostile per_page rather than forwarding it (BC-N is unreachable)", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage(`${PATH}?per_page=5000`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("per_page")).toBe("15");
  });

  it("rejects an unknown status in the URL", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage(`${PATH}?status=deleted`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBeNull();
  });

  it("rejects a non-numeric manager_id in the URL rather than forwarding it", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([], (u) => (url = u)),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage(`${PATH}?manager_id=not-a-number`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("manager_id")).toBeNull();
  });
});

describe("pagination", () => {
  it("moves to the next page and shows the position", async () => {
    let url: URL | undefined;
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")], (u) => (url = u), {
        current_page: 1,
        total: 30,
        last_page: 2,
      }),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("shows no pager when there is a single page", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui")], undefined, { last_page: 1 }),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      http.get(`${API}/admin/agents/commercials`, ({ request }) => {
        sentRequestId = request.headers.get("X-Request-Id");
        return HttpResponse.json({ success: false, message: "boom" }, { status: 500 });
      }),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    await waitFor(() => expect(sentRequestId).toBeTruthy());

    expect(within(alert).getByText(`Ref. ${sentRequestId}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("recovers on manual retry", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/agents/commercials`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(pageEnvelope([row(1, "Salma", "Alaoui")])),
      ),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Salma Alaoui")).toBeInTheDocument();
  });
});

describe("permission gating — each action on its own permission", () => {
  const rows = [row(1, "Salma", "Alaoui", { status: "active" })];

  it("shows edit, block (active account) to a fully-permitted operator", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.getByRole("button", { name: /edit salma alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block salma alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /activate salma alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("offers ACTIVATE and not BLOCK on a blocked account", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { status: "blocked" })]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.getByRole("button", { name: /activate salma alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block salma alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("offers BOTH block and activate on an inactive account", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { status: "inactive" })]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.getByRole("button", { name: /block salma alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /activate salma alaoui/i }),
    ).toBeInTheDocument();
  });

  it("hides EDIT without update-agent", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_AGENTS,
      PERMISSIONS.BLOCK_AGENT,
      PERMISSIONS.ACTIVATE_AGENT,
    ]);
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.queryByRole("button", { name: /edit salma alaoui/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block salma alaoui/i }),
    ).toBeInTheDocument();
  });

  it("hides BLOCK without block-agent", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_AGENTS,
      PERMISSIONS.UPDATE_AGENT,
    ]);
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.queryByRole("button", { name: /block salma alaoui/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit salma alaoui/i }),
    ).toBeInTheDocument();
  });

  it("FAILS CLOSED — a read-only operator sees the list and no row actions", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD, PERMISSIONS.VIEW_AGENTS]);
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.queryByRole("button", { name: /edit salma alaoui/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block salma alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("never offers a create action — onboarding is the M3.6 wizard", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.queryByRole("button", { name: /new commercial|add commercial|create/i }),
    ).not.toBeInTheDocument();
  });

  it("never offers a delete action — destroy is a soft block (BC-R)", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(
      screen.queryByRole("button", { name: /delete salma alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the city filter for an operator who cannot read villes", async () => {
    // access-dashboard gates GET /admin/villes; without it the options query
    // would 403, so the control must not render (and must not fire the
    // request — MSW's onUnhandledRequest:"error" would fail the test if it did).
    signInWith([PERMISSIONS.VIEW_AGENTS, PERMISSIONS.UPDATE_AGENT]);
    server.use(commercialsHandler(rows), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    expect(screen.queryByLabelText(/filter by current city/i)).not.toBeInTheDocument();
    // The other filters remain — including the manager filter, which needs
    // no separate permission (see commercial-manager-filter.tsx).
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by manager/i)).toBeInTheDocument();
  });

  it("still shows the manager filter for a view-agents-only operator with no access-dashboard", async () => {
    // GET /admin/agents/managers is gated on view-agents, the SAME string
    // that gates this page — never access-dashboard. No conditional mount is
    // needed, and this pins that the manager filter always resolves.
    signInWith([PERMISSIONS.VIEW_AGENTS]);
    server.use(commercialsHandler(rows), managersOptionsHandler());
    renderPage();

    await screen.findByText("Salma Alaoui");
    const managerSelect = await screen.findByLabelText(/filter by manager/i);
    expect(
      await within(managerSelect).findByRole("option", { name: "Karim Idrissi" }),
    ).toBeInTheDocument();
  });
});

describe("edit", () => {
  const rows = [
    row(1, "Salma", "Alaoui", {
      ville_actuelle: "Casablanca",
      num_abonnement: "AB-1",
    }),
  ];

  it("seeds the drawer from the row", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/first name/i)).toHaveValue("Salma");
    expect(within(dialog).getByLabelText(/last name/i)).toHaveValue("Alaoui");
    expect(within(dialog).getByLabelText(/current city/i)).toHaveValue("Casablanca");
    expect(within(dialog).getByLabelText(/subscription number/i)).toHaveValue("AB-1");
    // No manager field anywhere in the drawer — reassignment is out of scope.
    expect(within(dialog).queryByLabelText(/manager/i)).not.toBeInTheDocument();
  });

  it("seeds an empty string, not a null, for a null num_abonnement and null ville_actuelle", async () => {
    // The exact defect Managers shipped and then fixed live. Pinned here from
    // the first draft rather than discovered after the fact.
    server.use(
      commercialsHandler([
        row(1, "Salma", "Alaoui", { num_abonnement: null, ville_actuelle: null }),
      ]),
      villesHandler(),
      managersOptionsHandler(),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/current city/i)).toHaveValue("");
    expect(within(dialog).getByLabelText(/subscription number/i)).toHaveValue("");
    expect(
      within(dialog).getByRole("option", { name: "Select a city" }),
    ).toBeInTheDocument();
  });

  it("renders the current-city field as a select, not a free-text input", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/current city/i).tagName).toBe("SELECT");
  });

  it("selects the current city automatically from the Villes options", async () => {
    server.use(commercialsHandler(rows), villesHandler(), managersOptionsHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    const citySelect = within(dialog).getByLabelText(/current city/i);
    // toHaveValue on a <select> asserts exactly this: the selected option's
    // value, which is what "auto-selected from the options" means here.
    expect(citySelect).toHaveValue("Casablanca");
  });

  it("selecting another city sends its name, not an id, as the payload", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      commercialsHandler(rows),
      villesHandler(),
      managersOptionsHandler(),
      http.post(`${API}/admin/agents/1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    const citySelect = await within(dialog).findByLabelText(/current city/i);
    await within(citySelect).findByRole("option", { name: "Rabat" });
    fireEvent.change(citySelect, { target: { value: "Rabat" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(body?.ville_actuelle).toBe("Rabat"));
  });

  it("preserves a legacy current-city value absent from the Villes options, without silently dropping it", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      commercialsHandler([
        row(1, "Salma", "Alaoui", {
          ville_actuelle: "Marrakech",
          num_abonnement: "AB-1",
        }),
      ]),
      villesHandler(),
      managersOptionsHandler(),
      http.post(`${API}/admin/agents/1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    const citySelect = await within(dialog).findByLabelText(/current city/i);
    expect(citySelect).toHaveValue("Marrakech");
    expect(
      within(citySelect).getByRole("option", {
        name: /Marrakech.*not in the reference list/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));
    await waitFor(() => expect(body?.ville_actuelle).toBe("Marrakech"));
  });

  it("POSTs the update with the API's field spellings", async () => {
    let method: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      commercialsHandler(rows),
      villesHandler(),
      managersOptionsHandler(),
      http.post(`${API}/admin/agents/1`, async ({ request }) => {
        method = request.method;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, message: "updated", data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: "Sara" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect(method).toBe("POST");
    // ville_actuelle carries NO wire-name translation, unlike num_d_abonnement.
    expect(body).toEqual({
      nom: "Alaoui",
      prenom: "Sara",
      ville_actuelle: "Casablanca",
      num_d_abonnement: "AB-1",
    });
  });

  it("rejects an empty required field client-side", async () => {
    let posted = false;
    server.use(
      commercialsHandler(rows),
      villesHandler(),
      managersOptionsHandler(),
      http.post(`${API}/admin/agents/1`, () => {
        posted = true;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/first name is required/i),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("maps a field 422 onto its field, using the wire name", async () => {
    server.use(
      commercialsHandler(rows),
      villesHandler(),
      managersOptionsHandler(),
      http.post(`${API}/admin/agents/1`, () =>
        HttpResponse.json(
          {
            success: false,
            message: "Erreur de validation",
            errors: { num_d_abonnement: ["This subscription number is taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/subscription number is taken/i),
    ).toBeInTheDocument();
  });
});

describe("status actions", () => {
  it("confirms before blocking, naming the commercial, then PUTs", async () => {
    let called = false;
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { status: "active" })]),
      villesHandler(),
      managersOptionsHandler(),
      http.put(`${API}/admin/agents/1/block`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "blocked" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/block “Salma Alaoui”/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));
    await waitFor(() => expect(called).toBe(true));
  });

  it("PUTs the activate endpoint on a blocked account", async () => {
    let called = false;
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { status: "blocked" })]),
      villesHandler(),
      managersOptionsHandler(),
      http.put(`${API}/admin/agents/1/activate`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "activated" });
      }),
    );
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /activate salma alaoui/i }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(called).toBe(true));
  });

  it("surfaces a failure without closing the dialog", async () => {
    server.use(
      commercialsHandler([row(1, "Salma", "Alaoui", { status: "active" })]),
      villesHandler(),
      managersOptionsHandler(),
      http.put(`${API}/admin/agents/1/block`, () =>
        HttpResponse.json({ success: false, message: "nope" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block salma alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    expect(
      await within(dialog).findByRole("alert", {}, { timeout: 3000 }),
    ).toHaveTextContent(/could not be changed/i);
  });
});
