import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ManagersListPage } from "./managers-list-page";

const API = "http://localhost/api/v1";
const PATH = "/network/managers";

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
 * One transformed manager row, exactly as `indexManagers`' `transform()` emits it:
 * the wire keys are NOT the column names, `avance_total` is a preformatted STRING,
 * `date_debut` is a bare `Y-M-D`, `photo_path` is an absolute URL, and there is no
 * `commercials` array — only the count as `nombre_commerciaux`. `app_version` rides
 * along on the wire and is intentionally unmapped.
 */
function row(
  id: number,
  prenom: string,
  nom: string,
  overrides: Partial<{
    status: "active" | "blocked" | "inactive";
    num_abonnement: string;
    num_de_compte: string;
    avance_total: string;
    ville: string;
    ville_sous_responsabilite: string | null;
    nombre_commerciaux: number;
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
    num_de_compte: `MG000${id}`,
    avance_total: "1500.00",
    app_version: "1.4.2",
    ville: "Casablanca",
    ville_sous_responsabilite: "Grand Casablanca",
    nombre_commerciaux: 3,
    date_debut: "2026-01-15",
    photo_path: null,
    ...overrides,
  };
}

/**
 * The flat-paginator envelope: `{ success, data: { data: [...], current_page, … } }`.
 * The rows sit at `data.data`, and the page metadata beside them — NOT under `meta`.
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

function managersHandler(
  rows: ReturnType<typeof row>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/agents/managers`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows, meta));
  });
}

/** The Villes options endpoint, backing the city filter. Paginated envelope. */
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

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter([{ path: PATH, element: <ManagersListPage /> }], {
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

describe("managers list — flat-paginator contract", () => {
  it("renders rows from the { success, data: <paginator> } envelope", async () => {
    server.use(
      managersHandler([
        row(1, "Sara", "Alaoui"),
        row(2, "Youssef", "Bennani", { num_de_compte: "MG0002" }),
      ]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(screen.getByText("MG0002")).toBeInTheDocument();
  });

  it("sends page and per_page, and no sort parameter", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
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
    server.use(managersHandler([row(1, "Sara", "Alaoui")]), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    // Column titles are plain text, never buttons — there is nothing to sort by.
    expect(screen.queryByRole("button", { name: "Manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Joined" })).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(managersHandler([]), villesHandler());
    renderPage();

    expect(await screen.findByText(/no manager yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no managers' from 'none match these filters'", async () => {
    server.use(managersHandler([]), villesHandler());
    renderPage(`${PATH}?search=zzz`);

    expect(
      await screen.findByText(/no manager matches these filters/i),
    ).toBeInTheDocument();
  });
});

describe("mapping the transformed row", () => {
  it("renders avance_total verbatim as the backend's preformatted string", async () => {
    // The load-bearing money case: the value is NOT parsed or re-formatted. A
    // parse-and-format round trip would put "1234.56" through binary float.
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { avance_total: "1234.56" })]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("1234.56")).toBeInTheDocument();
  });

  it("shows the commercial COUNT, and assumes no commercials array", async () => {
    // `with(['commercials'])` is discarded by the transform (BC-Q); only the count
    // survives. Nothing in the UI may read a commercials collection.
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { nombre_commerciaux: 7 })]),
      villesHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("Sara Alaoui")).closest("tr")!;
    expect(within(tr).getByText("7")).toBeInTheDocument();
  });

  it("renders date_debut through the shared date formatter (DD/MM/YYYY)", async () => {
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { date_debut: "2026-01-15" })]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("15/01/2026")).toBeInTheDocument();
  });

  it("renders the absent dash for a null date_debut and null area", async () => {
    server.use(
      managersHandler([
        row(1, "Sara", "Alaoui", {
          date_debut: null,
          ville_sous_responsabilite: null,
        }),
      ]),
      villesHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("Sara Alaoui")).closest("tr")!;
    // Two absent cells: area and joined date. Never rendered as "null" or empty.
    expect(within(tr).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("does not render app_version — it is intentionally unmapped", async () => {
    server.use(managersHandler([row(1, "Sara", "Alaoui")]), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.queryByText("1.4.2")).not.toBeInTheDocument();
  });
});

describe("status rendering — a three-value enum, labelled locally", () => {
  it("labels each status without a shared badge", async () => {
    server.use(
      managersHandler([
        row(1, "Active", "One", { status: "active" }),
        row(2, "Blocked", "Two", { status: "blocked" }),
        row(3, "Inactive", "Three", { status: "inactive" }),
      ]),
      villesHandler(),
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
      managersHandler([row(1, "Sara", "Alaoui")], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?page=3`);

    await screen.findByText("Sara Alaoui");
    fireEvent.change(screen.getByLabelText(/search managers/i), {
      target: { value: "Bennani" },
    });

    await waitFor(() => expect(url?.searchParams.get("search")).toBe("Bennani"));
    // Back to page 1: the result set changed, so page 3 refers to a list that no
    // longer exists. (The REQUEST always carries an explicit page; it is the
    // browser URL that omits the default.)
    expect(url?.searchParams.get("page")).toBe("1");
  });
});

describe("filters — every supported one, and only those", () => {
  it("sends status", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: "blocked" },
    });

    await waitFor(() => expect(url?.searchParams.get("status")).toBe("blocked"));
  });

  it("sends ville as an EXACT value chosen from the city select", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    // The select is seeded from the Villes reference set — a text box would be a
    // lie over an exact-match backend filter. Wait for the options to arrive:
    // setting a value a select does not yet offer is a no-op.
    const citySelect = await screen.findByLabelText(/filter by city/i);
    await within(citySelect).findByRole("option", { name: "Rabat" });
    fireEvent.change(citySelect, { target: { value: "Rabat" } });

    await waitFor(() => expect(url?.searchParams.get("ville")).toBe("Rabat"));
  });

  it("sends ville_sous_responsabilite as a partial term", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/filter by area of responsibility/i), {
      target: { value: "Casa" },
    });

    await waitFor(() =>
      expect(url?.searchParams.get("ville_sous_responsabilite")).toBe("Casa"),
    );
  });

  it("sends date_from and date_to", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
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
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?status=inactive&ville=Rabat&search=Sara`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("inactive");
    expect(url?.searchParams.get("ville")).toBe("Rabat");
    expect(url?.searchParams.get("search")).toBe("Sara");
  });

  it("rejects a hostile per_page rather than forwarding it (BC-N is unreachable)", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    // 500 is the backend's own validation is out of range — the UI must never send it.
    renderPage(`${PATH}?per_page=5000`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("per_page")).toBe("15");
  });

  it("rejects an unknown status in the URL", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?status=deleted`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBeNull();
  });
});

describe("pagination", () => {
  it("moves to the next page and shows the position", async () => {
    let url: URL | undefined;
    server.use(
      managersHandler([row(1, "Sara", "Alaoui")], (u) => (url = u), {
        current_page: 1,
        total: 30,
        last_page: 2,
      }),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("shows no pager when there is a single page", async () => {
    server.use(
      managersHandler([row(1, "Sara", "Alaoui")], undefined, { last_page: 1 }),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      http.get(`${API}/admin/agents/managers`, ({ request }) => {
        sentRequestId = request.headers.get("X-Request-Id");
        return HttpResponse.json({ success: false, message: "boom" }, { status: 500 });
      }),
      villesHandler(),
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
      http.get(`${API}/admin/agents/managers`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(pageEnvelope([row(1, "Sara", "Alaoui")])),
      ),
      villesHandler(),
    );
    renderPage();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Sara Alaoui")).toBeInTheDocument();
  });
});

describe("permission gating — each action on its own permission", () => {
  const rows = [row(1, "Sara", "Alaoui", { status: "active" })];

  it("shows edit, block (active account) to a fully-permitted operator", async () => {
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.getByRole("button", { name: /edit sara alaoui/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block sara alaoui/i }),
    ).toBeInTheDocument();
    // Active account: activate would be a no-op (backend 400s), so it is not offered.
    expect(
      screen.queryByRole("button", { name: /activate sara alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("offers ACTIVATE and not BLOCK on a blocked account", async () => {
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { status: "blocked" })]),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.getByRole("button", { name: /activate sara alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block sara alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("offers BOTH block and activate on an inactive account", async () => {
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { status: "inactive" })]),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.getByRole("button", { name: /block sara alaoui/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /activate sara alaoui/i }),
    ).toBeInTheDocument();
  });

  it("hides EDIT without update-agent", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_AGENTS,
      PERMISSIONS.BLOCK_AGENT,
      PERMISSIONS.ACTIVATE_AGENT,
    ]);
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.queryByRole("button", { name: /edit sara alaoui/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block sara alaoui/i }),
    ).toBeInTheDocument();
  });

  it("hides BLOCK without block-agent", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_AGENTS,
      PERMISSIONS.UPDATE_AGENT,
    ]);
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.queryByRole("button", { name: /block sara alaoui/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit sara alaoui/i })).toBeInTheDocument();
  });

  it("FAILS CLOSED — a read-only operator sees the list and no row actions", async () => {
    // Holds view-agents (and access-dashboard for the filter) but no mutations.
    signInWith([PERMISSIONS.ACCESS_DASHBOARD, PERMISSIONS.VIEW_AGENTS]);
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.queryByRole("button", { name: /edit sara alaoui/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block sara alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("never offers a create action — onboarding is the M3.6 wizard", async () => {
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.queryByRole("button", { name: /new manager|add manager|create/i }),
    ).not.toBeInTheDocument();
  });

  it("never offers a delete action — destroy is a soft block (BC-R)", async () => {
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(
      screen.queryByRole("button", { name: /delete sara alaoui/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the city filter for an operator who cannot read villes", async () => {
    // access-dashboard gates GET /admin/villes; without it the options query would
    // 403, so the control must not render (and must not fire the request — MSW's
    // onUnhandledRequest:"error" would fail the test if it did).
    signInWith([PERMISSIONS.VIEW_AGENTS, PERMISSIONS.UPDATE_AGENT]);
    server.use(managersHandler(rows));
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.queryByLabelText(/filter by city/i)).not.toBeInTheDocument();
    // The other filters remain.
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
  });
});

describe("edit", () => {
  const rows = [
    row(1, "Sara", "Alaoui", {
      ville: "Casablanca",
      ville_sous_responsabilite: "Grand Casablanca",
      num_abonnement: "AB-1",
    }),
  ];

  it("seeds the drawer from the row", async () => {
    server.use(managersHandler(rows), villesHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/first name/i)).toHaveValue("Sara");
    expect(within(dialog).getByLabelText(/last name/i)).toHaveValue("Alaoui");
    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("Casablanca");
    expect(within(dialog).getByLabelText(/area of responsibility/i)).toHaveValue(
      "Grand Casablanca",
    );
    expect(within(dialog).getByLabelText(/subscription number/i)).toHaveValue("AB-1");
  });

  it("POSTs the update with the API's field spellings", async () => {
    let method: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      managersHandler(rows),
      villesHandler(),
      http.post(`${API}/admin/agents/1`, async ({ request }) => {
        method = request.method;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, message: "updated", data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/first name/i), {
      target: { value: "Sarah" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(body).toBeDefined());
    // POST, not PUT — routes register the update as a POST.
    expect(method).toBe("POST");
    // The wire uses `num_d_abonnement`, translated to the column by the controller.
    expect(body).toEqual({
      nom: "Alaoui",
      prenom: "Sarah",
      ville: "Casablanca",
      ville_sous_responsabilite: "Grand Casablanca",
      num_d_abonnement: "AB-1",
    });
  });

  it("rejects an empty required field client-side", async () => {
    let posted = false;
    server.use(
      managersHandler(rows),
      villesHandler(),
      http.post(`${API}/admin/agents/1`, () => {
        posted = true;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit sara alaoui/i }));
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
      managersHandler(rows),
      villesHandler(),
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

    fireEvent.click(await screen.findByRole("button", { name: /edit sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/subscription number is taken/i),
    ).toBeInTheDocument();
  });
});

describe("status actions", () => {
  it("confirms before blocking, naming the manager, then PUTs", async () => {
    let called = false;
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { status: "active" })]),
      villesHandler(),
      http.put(`${API}/admin/agents/1/block`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "blocked" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/block “Sara Alaoui”/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));
    await waitFor(() => expect(called).toBe(true));
  });

  it("PUTs the activate endpoint on a blocked account", async () => {
    let called = false;
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { status: "blocked" })]),
      villesHandler(),
      http.put(`${API}/admin/agents/1/activate`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "activated" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /activate sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(called).toBe(true));
  });

  it("surfaces a failure without closing the dialog", async () => {
    server.use(
      managersHandler([row(1, "Sara", "Alaoui", { status: "active" })]),
      villesHandler(),
      http.put(`${API}/admin/agents/1/block`, () =>
        HttpResponse.json({ success: false, message: "nope" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block sara alaoui/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    expect(
      await within(dialog).findByRole("alert", {}, { timeout: 3000 }),
    ).toHaveTextContent(/could not be changed/i);
  });
});
