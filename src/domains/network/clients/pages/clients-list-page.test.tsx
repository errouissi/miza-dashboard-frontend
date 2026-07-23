import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ClientsListPage } from "./clients-list-page";

const API = "http://localhost/api/v1";
const PATH = "/network/clients";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/** Every client permission this screen consumes — the fully-privileged operator. */
const ALL_CLIENT_PERMISSIONS = [
  PERMISSIONS.ACCESS_DASHBOARD, // for the ville filter's options query
  PERMISSIONS.VIEW_CLIENTS,
  PERMISSIONS.UPDATE_CLIENT,
  PERMISSIONS.MANAGE_CLIENT_STATUS,
  PERMISSIONS.ASSIGN_CLIENT,
];

/**
 * `view-agents` is a DIFFERENT permission from `assign-client` (see the
 * bulk-assign sheet's own docblock) — only tests that actually open the sheet
 * grant it, so `useCommercialOptionsQuery` stays disabled (and silent, no
 * unhandled-request warning) everywhere else, exactly like the ville
 * picker's own `access-dashboard` gate.
 */
const WITH_VIEW_AGENTS = [...ALL_CLIENT_PERMISSIONS, PERMISSIONS.VIEW_AGENTS];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * One raw client row, exactly as `ClientController::index` emits it — there
 * is NO transform, so this is the `Client` model's own serialization:
 * `solde` a preformatted decimal STRING, `created_at` a full ISO-8601
 * timestamp (not the bare `Y-M-D` the Agent domains use), `ville_comercial`
 * (not `ville` — the raw column is hidden), and a nested `agent` object
 * (not a concatenated string, and not absent) when assigned.
 */
function row(
  id: number,
  phone: string,
  overrides: Partial<{
    status: "active" | "blocked" | "pending";
    ville_comercial: string | null;
    solde: string;
    agent: { id: number; nom: string; prenom: string; num_compte: string } | null;
    created_at: string | null;
  }> = {},
) {
  return {
    id,
    phone,
    status: "active" as const,
    ville_comercial: "Casablanca",
    solde: "1500.00",
    agent: {
      id: 636,
      nom: "Alaoui",
      prenom: "Salma",
      num_compte: "DEV-CPT-COMMERCIAL-001",
    },
    created_at: "2026-02-10T10:30:00.000000Z",
    ...overrides,
  };
}

/**
 * The flat-paginator envelope: `{ success, data: { data: [...], current_page, … } }`.
 * The same shape as Managers/Commercials, verified live independently for Clients.
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

function clientsHandler(
  rows: ReturnType<typeof row>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/clients`, ({ request }) => {
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

/**
 * The Commercials endpoint, backing the bulk-assign sheet's commercial
 * picker (`useCommercialOptionsQuery`) — the same flat-paginator envelope as
 * `/admin/clients`. Records the request so a test can assert the picker
 * requests `status=active` at `per_page=100`.
 */
function commercialsHandler(onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/agents/commercials`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 636,
            nom: "Alaoui",
            prenom: "Salma",
            status: "active",
            num_abonnement: null,
            num_de_compte: "DEV-CPT-COMMERCIAL-001",
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
  const router = createMemoryRouter([{ path: PATH, element: <ClientsListPage /> }], {
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
  signInWith(ALL_CLIENT_PERMISSIONS);
});

describe("clients list — flat-paginator contract", () => {
  it("renders rows from the { success, data: <paginator> } envelope", async () => {
    server.use(
      clientsHandler([row(1, "0612345678"), row(2, "0687654321")]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("06 12 34 56 78")).toBeInTheDocument();
    expect(screen.getByText("06 87 65 43 21")).toBeInTheDocument();
  });

  it("sends page and per_page, and no sort or date parameter", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("15");
    // The endpoint accepts none of these — index()'s validator has no
    // sort/date parameter of any kind, unlike the Agent domains.
    expect(url?.searchParams.get("sort")).toBeNull();
    expect(url?.searchParams.get("date_from")).toBeNull();
    expect(url?.searchParams.get("date_to")).toBeNull();
  });

  it("renders no sortable header and no date filters", async () => {
    server.use(clientsHandler([row(1, "0612345678")]), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.queryByRole("button", { name: "Phone" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/joined from/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/joined before/i)).not.toBeInTheDocument();
  });

  it("renders no link to a detail page anywhere in the list", async () => {
    server.use(clientsHandler([row(1, "0612345678")]), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows a loading state before the first response arrives", async () => {
    let resolveRequest: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    server.use(
      http.get(`${API}/admin/clients`, async () => {
        await pending;
        return HttpResponse.json(pageEnvelope([row(1, "0612345678")]));
      }),
      villesHandler(),
    );
    renderPage();

    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument(),
    );
    resolveRequest?.();
    await screen.findByText("06 12 34 56 78");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(clientsHandler([]), villesHandler());
    renderPage();

    expect(await screen.findByText(/no client yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no clients' from 'none match these filters'", async () => {
    server.use(clientsHandler([]), villesHandler());
    renderPage(`${PATH}?search=0600`);

    expect(
      await screen.findByText(/no client matches these filters/i),
    ).toBeInTheDocument();
  });
});

describe("mapping the raw client row", () => {
  it("renders solde verbatim as the backend's decimal-cast string", async () => {
    server.use(
      clientsHandler([row(1, "0612345678", { solde: "789.10" })]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("789.10")).toBeInTheDocument();
  });

  it("renders the phone number grouped via the shared formatter", async () => {
    server.use(clientsHandler([row(1, "0612345678")]), villesHandler());
    renderPage();

    expect(await screen.findByText("06 12 34 56 78")).toBeInTheDocument();
  });

  it("derives the agent display name from the nested agent object", async () => {
    server.use(
      clientsHandler([
        row(1, "0612345678", {
          agent: { id: 640, nom: "Idrissi", prenom: "Karim", num_compte: "CM00002" },
        }),
      ]),
      villesHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("06 12 34 56 78")).closest("tr")!;
    expect(within(tr).getByText("Karim Idrissi")).toBeInTheDocument();
  });

  it("renders date_debut through the shared date formatter, from a full ISO-8601 timestamp", async () => {
    server.use(
      clientsHandler([
        row(1, "0612345678", { created_at: "2026-02-10T10:30:00.000000Z" }),
      ]),
      villesHandler(),
    );
    renderPage();

    expect(await screen.findByText("10/02/2026")).toBeInTheDocument();
  });

  it("renders the absent dash for a null ville, null agent and null created_at", async () => {
    server.use(
      clientsHandler([
        row(1, "0612345678", { ville_comercial: null, agent: null, created_at: null }),
      ]),
      villesHandler(),
    );
    renderPage();

    const tr = (await screen.findByText("06 12 34 56 78")).closest("tr")!;
    // Three absent cells: city, agent, joined date.
    expect(within(tr).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("status rendering — a three-value enum, a different vocabulary than the Agent domains", () => {
  it("labels each status without a shared badge, including pending", async () => {
    server.use(
      clientsHandler([
        row(1, "0611111111", { status: "active" }),
        row(2, "0622222222", { status: "blocked" }),
        row(3, "0633333333", { status: "pending" }),
      ]),
      villesHandler(),
    );
    renderPage();

    const activeRow = (await screen.findByText("06 11 11 11 11")).closest("tr")!;
    const blockedRow = screen.getByText("06 22 22 22 22").closest("tr")!;
    const pendingRow = screen.getByText("06 33 33 33 33").closest("tr")!;

    expect(within(activeRow).getByText("Active")).toBeInTheDocument();
    expect(within(blockedRow).getByText("Blocked")).toBeInTheDocument();
    expect(within(pendingRow).getByText("Pending")).toBeInTheDocument();
  });
});

describe("search — a real backend parameter", () => {
  it("sends the term as `search` and resets to page 1", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([row(1, "0612345678")], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?page=3`);

    await screen.findByText("06 12 34 56 78");
    fireEvent.change(screen.getByLabelText(/search clients/i), {
      target: { value: "0698" },
    });

    await waitFor(() => expect(url?.searchParams.get("search")).toBe("0698"));
    expect(url?.searchParams.get("page")).toBe("1");
  });
});

describe("filters — every supported one, and only those", () => {
  it("sends status", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: "pending" },
    });

    await waitFor(() => expect(url?.searchParams.get("status")).toBe("pending"));
  });

  it("sends assigned as the literal string true/false", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    fireEvent.change(screen.getByLabelText(/filter by assignment/i), {
      target: { value: "false" },
    });

    await waitFor(() => expect(url?.searchParams.get("assigned")).toBe("false"));
  });

  it("sends ville_comercial as an EXACT value chosen from the city select", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage();

    const citySelect = await screen.findByLabelText(/filter by city/i);
    await within(citySelect).findByRole("option", { name: "Rabat" });
    fireEvent.change(citySelect, { target: { value: "Rabat" } });

    await waitFor(() => expect(url?.searchParams.get("ville_comercial")).toBe("Rabat"));
  });

  it("reads filters back out of the URL on load", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?status=blocked&assigned=true&ville_comercial=Rabat&search=0600`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("blocked");
    expect(url?.searchParams.get("assigned")).toBe("true");
    expect(url?.searchParams.get("ville_comercial")).toBe("Rabat");
    expect(url?.searchParams.get("search")).toBe("0600");
  });

  it("rejects a hostile per_page rather than forwarding it", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?per_page=5000`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("per_page")).toBe("15");
  });

  it("rejects an unknown status in the URL", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?status=deleted`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBeNull();
  });

  it("rejects an unknown assigned value in the URL", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([], (u) => (url = u)),
      villesHandler(),
    );
    renderPage(`${PATH}?assigned=maybe`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("assigned")).toBeNull();
  });
});

describe("pagination", () => {
  it("moves to the next page and shows the position", async () => {
    let url: URL | undefined;
    server.use(
      clientsHandler([row(1, "0612345678")], (u) => (url = u), {
        current_page: 1,
        total: 30,
        last_page: 2,
      }),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("shows no pager when there is a single page", async () => {
    server.use(
      clientsHandler([row(1, "0612345678")], undefined, { last_page: 1 }),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      http.get(`${API}/admin/clients`, ({ request }) => {
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
      http.get(`${API}/admin/clients`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(pageEnvelope([row(1, "0612345678")])),
      ),
      villesHandler(),
    );
    renderPage();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("06 12 34 56 78")).toBeInTheDocument();
  });
});

describe("permission gating — each action on its own permission", () => {
  const rows = [row(1, "0612345678", { status: "active" })];

  it("shows edit and status action to a fully-permitted operator", async () => {
    server.use(clientsHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.getByRole("button", { name: /edit 0612345678/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /block 0612345678/i })).toBeInTheDocument();
  });

  it("labels the status action Activate for a blocked client", async () => {
    server.use(
      clientsHandler([row(1, "0612345678", { status: "blocked" })]),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.getByRole("button", { name: /activate 0612345678/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block 0612345678/i }),
    ).not.toBeInTheDocument();
  });

  it("labels the status action Activate for a pending client too", async () => {
    // toggleStatus() sends anything other than "active" to "active" — a
    // pending client's only possible transition is approval, so the button
    // must say Activate, not something implying a toggle.
    server.use(
      clientsHandler([row(1, "0612345678", { status: "pending" })]),
      villesHandler(),
    );
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.getByRole("button", { name: /activate 0612345678/i }),
    ).toBeInTheDocument();
  });

  it("hides EDIT without update-client", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.MANAGE_CLIENT_STATUS,
    ]);
    server.use(clientsHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.queryByRole("button", { name: /edit 0612345678/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /block 0612345678/i })).toBeInTheDocument();
  });

  it("hides the status action without manage-client-status", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.UPDATE_CLIENT,
    ]);
    server.use(clientsHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.queryByRole("button", { name: /block 0612345678/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit 0612345678/i })).toBeInTheDocument();
  });

  it("FAILS CLOSED — a read-only operator sees the list and no row actions", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD, PERMISSIONS.VIEW_CLIENTS]);
    server.use(clientsHandler(rows), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.queryByRole("button", { name: /edit 0612345678/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block 0612345678/i }),
    ).not.toBeInTheDocument();
  });

  it("never offers create, delete, or single-client assign/reassign/unassign — bulk-assign (M3.5) is the only assignment action", async () => {
    // Superseded by M3.5: bulk-assign is now an explicit, approved deliverable,
    // so a page-level "Assign to commercial" button legitimately exists. What
    // must still never appear is a PER-ROW assign/reassign/unassign action —
    // named after a phone number, exactly like the real row actions
    // (`edit 0612345678`, `block 0612345678`) — which remains out of scope.
    server.use(clientsHandler(rows), villesHandler(), commercialsHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.queryByRole("button", { name: /new client|add client|^create$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete 0612345678/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /assign 0612345678|reassign 0612345678|unassign 0612345678/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset password|statistics/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the city filter for an operator who cannot read villes", async () => {
    signInWith([PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.UPDATE_CLIENT]);
    server.use(clientsHandler(rows));
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.queryByLabelText(/filter by city/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
  });
});

describe("edit", () => {
  const rows = [row(1, "0612345678", { ville_comercial: "Casablanca" })];

  it("seeds the drawer from the row", async () => {
    server.use(clientsHandler(rows), villesHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/phone/i)).toHaveValue("0612345678");
    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("Casablanca");
  });

  it("shows the placeholder for a null city", async () => {
    server.use(
      clientsHandler([row(1, "0612345678", { ville_comercial: null })]),
      villesHandler(),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("");
    expect(
      within(dialog).getByRole("option", { name: "Select a city" }),
    ).toBeInTheDocument();
  });

  it("preserves a legacy city value absent from the Villes options", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      clientsHandler([row(1, "0612345678", { ville_comercial: "Marrakech" })]),
      villesHandler(),
      http.put(`${API}/admin/clients/1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");

    const citySelect = await within(dialog).findByLabelText(/^city$/i);
    expect(citySelect).toHaveValue("Marrakech");
    expect(
      within(citySelect).getByRole("option", {
        name: /Marrakech.*not in the reference list/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));
    await waitFor(() => expect(body?.ville_comercial).toBe("Marrakech"));
  });

  it("PUTs the update with the API's field spellings", async () => {
    let method: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      clientsHandler(rows),
      villesHandler(),
      http.put(`${API}/admin/clients/1`, async ({ request }) => {
        method = request.method;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/phone/i), {
      target: { value: "0698765432" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(body).toBeDefined());
    // PUT, a normal REST verb — no POST-not-PUT oddity here.
    expect(method).toBe("PUT");
    expect(body).toEqual({
      phone: "0698765432",
      ville_comercial: "Casablanca",
    });
  });

  it("rejects an empty phone client-side", async () => {
    let posted = false;
    server.use(
      clientsHandler(rows),
      villesHandler(),
      http.put(`${API}/admin/clients/1`, () => {
        posted = true;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/phone/i), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/phone number is required/i),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("rejects a malformed phone client-side, mirroring the backend's own regex", async () => {
    let posted = false;
    server.use(
      clientsHandler(rows),
      villesHandler(),
      http.put(`${API}/admin/clients/1`, () => {
        posted = true;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/phone/i), {
      target: { value: "12345" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/valid moroccan phone number/i),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("maps a field 422 onto its field, using the wire name", async () => {
    server.use(
      clientsHandler(rows),
      villesHandler(),
      http.put(`${API}/admin/clients/1`, () =>
        HttpResponse.json(
          {
            success: false,
            message: "Validation failed",
            errors: { phone: ["This phone number is already in use."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(
      await within(dialog).findByText(/phone number is already in use/i),
    ).toBeInTheDocument();
  });
});

describe("status action", () => {
  it("confirms before blocking an active client, naming the phone, then PATCHes", async () => {
    let called = false;
    server.use(
      clientsHandler([row(1, "0612345678", { status: "active" })]),
      villesHandler(),
      http.patch(`${API}/admin/clients/1/status`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "updated" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/block “0612345678”/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));
    await waitFor(() => expect(called).toBe(true));
  });

  it("PATCHes the status endpoint to activate a blocked client", async () => {
    let called = false;
    server.use(
      clientsHandler([row(1, "0612345678", { status: "blocked" })]),
      villesHandler(),
      http.patch(`${API}/admin/clients/1/status`, () => {
        called = true;
        return HttpResponse.json({ success: true, message: "updated" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /activate 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(called).toBe(true));
  });

  it("surfaces a failure without closing the dialog", async () => {
    server.use(
      clientsHandler([row(1, "0612345678", { status: "active" })]),
      villesHandler(),
      http.patch(`${API}/admin/clients/1/status`, () =>
        HttpResponse.json({ success: false, message: "nope" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block 0612345678/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    expect(
      await within(dialog).findByRole("alert", {}, { timeout: 3000 }),
    ).toHaveTextContent(/could not be changed/i);
  });
});

describe("bulk-assign (M3.5) — permission gating and fail-closed behavior", () => {
  it("shows the selection checkboxes and select-all to an operator with assign-client", async () => {
    server.use(
      clientsHandler([row(1, "0612345678")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(screen.getByLabelText("Select all clients on this page")).toBeInTheDocument();
    expect(screen.getByLabelText("Select 0612345678")).toBeInTheDocument();
  });

  it("FAILS CLOSED — hides checkboxes, select-all and the action bar without assign-client", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.UPDATE_CLIENT,
      PERMISSIONS.MANAGE_CLIENT_STATUS,
    ]);
    server.use(clientsHandler([row(1, "0612345678")]), villesHandler());
    renderPage();

    await screen.findByText("06 12 34 56 78");
    expect(
      screen.queryByLabelText("Select all clients on this page"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select 0612345678")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /assign to commercial/i }),
    ).not.toBeInTheDocument();
  });
});

describe("bulk-assign (M3.5) — row selection and current-page select-all", () => {
  it("selects and deselects an individual row, showing the running count", async () => {
    server.use(
      clientsHandler([row(1, "0611111111"), row(2, "0622222222")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(
      await screen.findByText(/1 client selected on this page/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument();
  });

  it("select-all-on-page selects every row on the page, and only the page", async () => {
    server.use(
      clientsHandler([row(1, "0611111111"), row(2, "0622222222")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select all clients on this page"));

    expect(
      await screen.findByText(/2 clients selected on this page/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Select 0611111111")).toBeChecked();
    expect(screen.getByLabelText("Select 0622222222")).toBeChecked();
  });

  it("unchecking select-all clears every row's selection", async () => {
    server.use(
      clientsHandler([row(1, "0611111111"), row(2, "0622222222")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    const selectAll = screen.getByLabelText("Select all clients on this page");
    fireEvent.click(selectAll);
    fireEvent.click(selectAll);

    expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select 0611111111")).not.toBeChecked();
  });
});

describe("bulk-assign (M3.5) — selection is current-page-only, never persisted", () => {
  it("clears selection when the page changes", async () => {
    server.use(
      clientsHandler([row(1, "0611111111")], undefined, {
        current_page: 1,
        total: 30,
        last_page: 2,
      }),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(await screen.findByText(/1 client selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument(),
    );
  });

  it("does not restore selection when navigating back to a previously selected page", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/clients`, ({ request }) => {
        url = new URL(request.url);
        const currentPage = Number(url.searchParams.get("page")) || 1;
        return HttpResponse.json(
          pageEnvelope([row(1, "0611111111")], {
            current_page: currentPage,
            total: 30,
            last_page: 2,
          }),
        );
      }),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));

    // Page 1's response is already SLOW-cached from the initial load, so
    // clicking "Previous" may serve it without a new network round-trip —
    // asserted on the resulting DOM (the Previous button disables again on
    // page 1), not on `url`, which would otherwise wait on a request that
    // never has to happen.
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled(),
    );

    expect(screen.getByLabelText("Select 0611111111")).not.toBeChecked();
  });

  it("clears selection when the search term changes", async () => {
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(await screen.findByText(/1 client selected/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search clients/i), {
      target: { value: "0698" },
    });
    await waitFor(() =>
      expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument(),
    );
  });

  it("clears selection when the status filter changes", async () => {
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(await screen.findByText(/1 client selected/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: "blocked" },
    });
    await waitFor(() =>
      expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument(),
    );
  });

  it("clears selection when the assigned filter changes", async () => {
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(await screen.findByText(/1 client selected/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by assignment/i), {
      target: { value: "false" },
    });
    await waitFor(() =>
      expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument(),
    );
  });

  it("clears selection when the city filter changes", async () => {
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    expect(await screen.findByText(/1 client selected/i)).toBeInTheDocument();

    const citySelect = await screen.findByLabelText(/filter by city/i);
    await within(citySelect).findByRole("option", { name: "Rabat" });
    fireEvent.change(citySelect, { target: { value: "Rabat" } });

    await waitFor(() =>
      expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument(),
    );
  });

  it("never sends more than 100 ids, even selecting all on a full 100-row page", async () => {
    signInWith(WITH_VIEW_AGENTS);
    const hundredRows = Array.from({ length: 100 }, (_, i) =>
      row(i + 1, `06${String(i).padStart(8, "0")}`),
    );
    let body: Record<string, unknown> | undefined;
    server.use(
      clientsHandler(hundredRows, undefined, { per_page: 100, total: 100, last_page: 1 }),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { agent_id: 636, assigned_count: 100, client_ids: [] },
        });
      }),
    );
    renderPage(`${PATH}?per_page=100`);

    await screen.findByLabelText("Select all clients on this page");
    fireEvent.click(screen.getByLabelText("Select all clients on this page"));
    expect(await screen.findByText(/100 clients selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));
    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    await waitFor(() => expect(body).toBeDefined());
    const clientIds = body?.client_ids as number[];
    expect(clientIds).toHaveLength(100);
  });
});

describe("bulk-assign (M3.5) — assignment flow", () => {
  it("sends agent_id and client_ids as the payload, nothing else", async () => {
    signInWith(WITH_VIEW_AGENTS);
    let body: Record<string, unknown> | undefined;
    server.use(
      clientsHandler([row(1, "0611111111"), row(2, "0622222222")]),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { agent_id: 636, assigned_count: 2, client_ids: [1, 2] },
        });
      }),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByLabelText("Select 0622222222"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    await waitFor(() => expect(body).toEqual({ agent_id: 636, client_ids: [1, 2] }));
    expect(Object.keys(body!).sort()).toEqual(["agent_id", "client_ids"]);
  });

  it("invalidates the list and clears selection after a successful assignment", async () => {
    signInWith(WITH_VIEW_AGENTS);
    let getCount = 0;
    server.use(
      http.get(`${API}/admin/clients`, () => {
        getCount += 1;
        return HttpResponse.json(pageEnvelope([row(1, "0611111111")]));
      }),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, () =>
        HttpResponse.json({
          success: true,
          message: "ok",
          data: { agent_id: 636, assigned_count: 1, client_ids: [1] },
        }),
      ),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/selected on this page/i)).not.toBeInTheDocument();
    await waitFor(() => expect(getCount).toBeGreaterThan(1));
  });

  it("maps a field-level 422 (validation envelope) onto the commercial field", async () => {
    signInWith(WITH_VIEW_AGENTS);
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, () =>
        HttpResponse.json(
          {
            success: false,
            message: "Validation failed",
            errors: { agent_id: ["The selected agent id is invalid."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    expect(
      await within(dialog).findByText(/selected agent id is invalid/i),
    ).toBeInTheDocument();
  });

  it("shows a generic error for a code-less business-rule 422, not the backend's message", async () => {
    signInWith(WITH_VIEW_AGENTS);
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, () =>
        HttpResponse.json(
          { success: false, message: "agent_id must reference an active commercial" },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    const alert = await within(dialog).findByRole("alert", {}, { timeout: 3000 });
    expect(alert).toHaveTextContent(/could not be completed/i);
    expect(alert).not.toHaveTextContent(/must reference an active commercial/i);
  });
});

describe("bulk-assign (M3.5) — city and sector are conceptually unchanged", () => {
  it("states in its copy that only the commercial changes, not city or sector", async () => {
    signInWith(WITH_VIEW_AGENTS);
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/city and sector are left exactly as they are/i),
    ).toBeInTheDocument();
  });

  it("never sends ville, secteur or any field beyond agent_id/client_ids", async () => {
    signInWith(WITH_VIEW_AGENTS);
    let body: Record<string, unknown> | undefined;
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler(),
      http.patch(`${API}/admin/clients/assign-bulk`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { agent_id: 636, assigned_count: 1, client_ids: [1] },
        });
      }),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    const dialog = await screen.findByRole("dialog");
    const commercialSelect = await within(dialog).findByLabelText(/commercial/i);
    await within(commercialSelect).findByRole("option", { name: "Salma Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "636" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^assign$/i }));

    await waitFor(() => expect(body).toBeDefined());
    expect(Object.keys(body!).sort()).toEqual(["agent_id", "client_ids"]);
  });
});

describe("bulk-assign (M3.5) — commercial picker requests active-only, bounded", () => {
  it("requests status=active at per_page=100 when the sheet opens", async () => {
    signInWith(WITH_VIEW_AGENTS);
    let url: URL | undefined;
    server.use(
      clientsHandler([row(1, "0611111111")]),
      villesHandler(),
      commercialsHandler((u) => (url = u)),
    );
    renderPage();

    await screen.findByText("06 11 11 11 11");
    fireEvent.click(screen.getByLabelText("Select 0611111111"));
    fireEvent.click(screen.getByRole("button", { name: /assign to commercial/i }));

    await screen.findByRole("dialog");
    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("active");
    expect(url?.searchParams.get("per_page")).toBe("100");
  });
});
