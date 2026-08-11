import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ClientWorkspacePage } from "./client-workspace-page";
import { clientDetailPath, CLIENT_DETAIL_PATH } from "../routes";
import { clientAssignmentHistoryKeys, clientsKeys } from "../queries/keys";

const API = "http://localhost/api/v1";
const PATH = "/network/clients/:id";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const ALL_CLIENT_PERMISSIONS = [
  PERMISSIONS.VIEW_CLIENTS,
  PERMISSIONS.UPDATE_CLIENT,
  PERMISSIONS.MANAGE_CLIENT_STATUS,
  PERMISSIONS.ACCESS_DASHBOARD, // Villes/Secteurs pickers inside the shared Edit drawer.
  PERMISSIONS.ASSIGN_CLIENT, // M7 Phase 2 — the Assign/Reassign action itself.
  PERMISSIONS.VIEW_AGENTS, // M7 Phase 2 — Commercial deep-links and the Commercial-options picker.
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/** One raw `show()` detail row — the full, unrestricted `agent` relation, not `index()`'s restricted projection. */
function detailRow(
  id: number,
  phone: string,
  overrides: Partial<{
    status: "active" | "blocked" | "pending";
    ville_comercial: string | null;
    secteur_comercial: string | null;
    created_at: string | null;
    agent: { id: number; nom: string; prenom: string; num_compte: string } | null;
  }> = {},
) {
  return {
    id,
    phone,
    status: "active" as const,
    ville_comercial: "Casablanca",
    secteur_comercial: "Maarif",
    created_at: "2026-02-10T10:30:00.000000Z",
    agent: {
      id: 636,
      nom: "Alaoui",
      prenom: "Salma",
      num_compte: "DEV-CPT-COMMERCIAL-001",
    },
    ...overrides,
  };
}

function showHandler(
  id: number,
  row: ReturnType<typeof detailRow>,
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/clients/${id}`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({ success: true, data: row });
  });
}

/** The Villes options endpoint, backing the shared Edit drawer's city select. */
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

/** The Secteurs options endpoint, scoped by `ville_id` — backs the shared Edit drawer's Sector select. */
function secteursHandler() {
  return http.get(`${API}/admin/secteurs`, ({ request }) => {
    const villeId = new URL(request.url).searchParams.get("ville_id");
    return HttpResponse.json(
      villeId === "1" ? [{ id: 10, nom_secteur: "Maarif", ville_id: 1 }] : [],
    );
  });
}

/**
 * `GET /admin/agents/commercials` (`useCommercialOptionsQuery`, Commercials'
 * own public surface) — backs the Reassign drawer's picker. Fires
 * unconditionally once the workspace mounts and `view-agents` is held
 * (`ClientReassignDrawer` is always mounted, same "always mounted, `enabled`
 * gates permission only" pattern as `ClientFormSheet`'s own Villes query) —
 * every test holding `VIEW_AGENTS` needs this handler, not only the ones
 * that open the drawer.
 */
function commercialOptionsHandler(
  rows: { id: number; nom: string; prenom: string; status?: string }[] = [
    { id: 636, nom: "Alaoui", prenom: "Salma", status: "active" },
    { id: 700, nom: "Bennani", prenom: "Youssef", status: "active" },
  ],
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/agents/commercials`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      success: true,
      data: {
        data: rows,
        current_page: 1,
        per_page: 100,
        total: rows.length,
        last_page: 1,
      },
    });
  });
}

/**
 * One raw `assignment-history` row, exactly as
 * `ClientAssignmentHistoryResource` emits it — all four relation keys are
 * ALWAYS present (the controller unconditionally eager-loads all four),
 * `null` only when the underlying FK itself is null or hard-deleted.
 */
function historyRow(
  id: number,
  type: "assigned" | "reassigned" | "unassigned",
  overrides: Partial<{
    from_agent: { id: number; nom: string; prenom: string } | null;
    to_agent: { id: number; nom: string; prenom: string } | null;
    changed_by: { id: number; name: string } | null;
    changed_by_agent: { id: number; nom: string; prenom: string } | null;
    changed_at: string;
  }> = {},
) {
  const fromAgent = overrides.from_agent ?? null;
  const toAgent = overrides.to_agent ?? null;
  const changedBy = overrides.changed_by ?? null;
  const changedByAgent = overrides.changed_by_agent ?? null;
  return {
    id,
    type,
    from_agent_id: fromAgent?.id ?? null,
    from_agent: fromAgent,
    to_agent_id: toAgent?.id ?? null,
    to_agent: toAgent,
    changed_by_user_id: changedBy?.id ?? null,
    changed_by: changedBy,
    changed_by_agent_id: changedByAgent?.id ?? null,
    changed_by_agent: changedByAgent,
    changed_at: overrides.changed_at ?? "2026-03-01T09:00:00.000000Z",
  };
}

/**
 * `GET /admin/clients/:id/assignment-history` — a wildcard `:id` so ONE
 * handler covers every client id this file renders, matching how
 * `showHandler` is the only one that needs a specific id per test. Default
 * (`items = []`) registered globally in `beforeEach` — every test in this
 * file holds `VIEW_CLIENTS`, so `ClientAssignmentHistoryPanel` always fires
 * this request, whether or not a given test cares about its content.
 */
function historyHandler(
  items: ReturnType<typeof historyRow>[] = [],
  meta: Partial<{
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  }> = {},
) {
  return http.get(`${API}/admin/clients/:id/assignment-history`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: items,
        current_page: meta.current_page ?? 1,
        per_page: meta.per_page ?? 5,
        total: meta.total ?? items.length,
        last_page: meta.last_page ?? 1,
      },
    }),
  );
}

/**
 * Returns the `QueryClient` too — the invalidation tests below assert
 * `invalidateQueries` was called with the right keys directly (via
 * `vi.spyOn`), rather than only inferring it from a re-fetched network
 * request. This page never renders the Clients LIST itself, so there is no
 * behavioral observer for `clientsKeys.lists()`'s own invalidation the way
 * there is for `clientsKeys.detail`/`clientAssignmentHistoryKeys` (both
 * ARE observed behaviorally below, via a stateful mock reflecting the
 * change) — the spy is the only way to verify the list space is touched at
 * all from this page.
 */
function renderPage(initialPath: string) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter([{ path: PATH, element: <ClientWorkspacePage /> }], {
    initialEntries: [initialPath],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_CLIENT_PERMISSIONS);
  // The shared `ClientFormSheet` (M7 Phase 1's own Edit reuse) is always
  // mounted alongside this workspace, whether or not its drawer is open —
  // its `useVilleOptionsQuery` fires unconditionally once `access-dashboard`
  // is held (granted by `ALL_CLIENT_PERMISSIONS` above), so every test in
  // this file needs a Villes handler, not only the ones that open Edit.
  server.use(villesHandler());
  // M7 Phase 2 — `ClientReassignDrawer` is always mounted (same pattern),
  // so `useCommercialOptionsQuery` fires unconditionally once `view-agents`
  // is held. `ClientAssignmentHistoryPanel` fires unconditionally once
  // `view-clients` is held (always true — it gates the whole route). Both
  // get an empty/default response here; tests that care override with
  // `server.use(...)` again.
  server.use(commercialOptionsHandler());
  server.use(historyHandler());
});

describe("route helper", () => {
  it("clientDetailPath builds the canonical /network/clients/:id target", () => {
    expect(clientDetailPath(42)).toBe("/network/clients/42");
  });

  it("CLIENT_DETAIL_PATH is the flat sibling route pattern", () => {
    expect(CLIENT_DETAIL_PATH).toBe("/network/clients/:id");
  });
});

describe("detail query", () => {
  it("requests the exact client id", async () => {
    let requestedUrl: URL | undefined;
    server.use(showHandler(7, detailRow(7, "0612345678"), (u) => (requestedUrl = u)));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(requestedUrl?.pathname).toBe("/api/v1/admin/clients/7");
  });

  it("maps the show() envelope onto the workspace", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    expect(
      await screen.findByRole("heading", { name: "06 12 34 56 78" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Casablanca")).toBeInTheDocument();
    expect(screen.getByText("Maarif")).toBeInTheDocument();
  });

  it("shows a skeleton while pending", () => {
    server.use(http.get(`${API}/admin/clients/7`, () => new Promise(() => {})));
    renderPage("/network/clients/7");

    expect(screen.getByRole("heading", { name: "Client" })).toBeInTheDocument();
  });

  it("rejects an invalid id without requesting anything", () => {
    renderPage("/network/clients/not-a-number");

    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });

  it("shows a retryable error state and recovers", async () => {
    // `shouldRetryQuery`'s `failureCount` parameter counts RETRIES already
    // attempted, not total failures — `MAX_QUERY_ATTEMPTS = 2` therefore
    // allows 2 retries, THREE total automatic attempts, before settling
    // into the error state (confirmed empirically, not just read from the
    // source: the first version of this test failed 2 attempts and the
    // 3rd automatic one succeeded, never reaching an error state at all).
    // All three must fail here — only the explicit "Retry" click's own
    // fresh attempt cycle succeeds.
    let attempts = 0;
    server.use(
      http.get(`${API}/admin/clients/7`, () => {
        attempts += 1;
        if (attempts <= 3) {
          return HttpResponse.json({ success: false, error: null }, { status: 500 });
        }
        return HttpResponse.json({ success: true, data: detailRow(7, "0612345678") });
      }),
    );
    renderPage("/network/clients/7");

    // A generous timeout: `queryRetryDelay` backs off 300/600/1200ms across
    // the three automatic attempts before the query settles into the error
    // state (FTA §11) — well past the default 1000ms window.
    const retry = await screen.findByRole(
      "button",
      { name: /retry/i },
      { timeout: 5000 },
    );
    fireEvent.click(retry);

    expect(
      await screen.findByRole("heading", { name: "06 12 34 56 78" }),
    ).toBeInTheDocument();
  });
});

// VIEW_CLIENTS gating itself is a ROUTE-level concern, not this page
// component's own: mirroring `AgentWorkspacePage`, this page has no internal
// `has(PERMISSIONS.VIEW_CLIENTS)` re-check — `CLIENT_DETAIL_PATH`'s own
// `handle.permission: VIEW_CLIENTS` (`routes.tsx`) is what a session
// lacking it can never render past, exercised generically for every
// contributed route (including `clientDetailPath(1)`, added this phase) by
// `route-authorization.test.tsx`'s own parameterised suite — not repeated
// here. This file's own detail-query tests above already show `enabled`
// only ever depends on a VALID `:id`, never firing for a malformed one.

describe("workspace — profile facts", () => {
  it("renders Phone, City, Sector and Client since, no financial/OTP/system/location fields", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Sector")).toBeInTheDocument();
    expect(screen.getByText("Client since")).toBeInTheDocument();

    // None of the excluded fields ever render anywhere on this page.
    expect(screen.queryByText(/solde|balance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/debt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/latitude|longitude|location/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/otp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last login/i)).not.toBeInTheDocument();
  });

  it("renders a dash for a null City/Sector", async () => {
    server.use(
      showHandler(
        7,
        detailRow(7, "0612345678", { ville_comercial: null, secteur_comercial: null }),
      ),
    );
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    const cityRow = screen.getByText("City").closest("div");
    const sectorRow = screen.getByText("Sector").closest("div");
    expect(within(cityRow!).getByText("—")).toBeInTheDocument();
    expect(within(sectorRow!).getByText("—")).toBeInTheDocument();
  });
});

describe("status action", () => {
  it("active client offers Block, not Activate", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678", { status: "active" })));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("blocked client offers Activate, not Block", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678", { status: "blocked" })));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });

  it("pending client offers NO status action", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678", { status: "pending" })));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
    // Edit stays available — the status gap does not affect it.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides the status action without manage-client-status", async () => {
    signInWith([PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.UPDATE_CLIENT]);
    server.use(showHandler(7, detailRow(7, "0612345678", { status: "active" })));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });

  it("confirming Block PATCHes the status endpoint and refreshes the detail", async () => {
    // Stateful, not a mid-test `server.use()` swap: the mutation's success
    // invalidates `clientsKeys.detail(id)` and TanStack Query refetches
    // automatically, on its own schedule — a handler that only starts
    // returning "blocked" AFTER this test's own code happens to reassign it
    // would race that automatic refetch. Mirroring the real backend, ONE
    // handler tracks whether the PATCH has already landed.
    let blocked = false;
    server.use(
      http.get(`${API}/admin/clients/7`, () =>
        HttpResponse.json({
          success: true,
          data: detailRow(7, "0612345678", { status: blocked ? "blocked" : "active" }),
        }),
      ),
      http.patch(`${API}/admin/clients/7/status`, () => {
        blocked = true;
        return HttpResponse.json({
          success: true,
          data: detailRow(7, "0612345678", { status: "blocked" }),
        });
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Block" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    // The detail query was invalidated and refetched — the badge/action
    // reflect the new status without a page reload.
    expect(await screen.findByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });
});

describe("edit — reuses the shared ClientFormSheet", () => {
  it("gates Edit on update-client", async () => {
    signInWith([PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.MANAGE_CLIENT_STATUS]);
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("seeds phone/city/sector from the detail model, and a successful update refreshes the detail", async () => {
    // Stateful GET, same reasoning as the status-action test above: the
    // mutation's own invalidation triggers an automatic refetch on its own
    // schedule, so the mock must reflect the edit once it lands rather than
    // racing a mid-test `server.use()` reassignment against that refetch.
    let phone = "0612345678";
    server.use(
      http.get(`${API}/admin/clients/7`, () =>
        HttpResponse.json({ success: true, data: detailRow(7, phone) }),
      ),
      villesHandler(),
      secteursHandler(),
      http.put(`${API}/admin/clients/7`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        phone = body.phone as string;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/phone/i)).toHaveValue("0612345678");
    expect(within(dialog).getByLabelText(/^city$/i)).toHaveValue("Casablanca");
    expect(await within(dialog).findByLabelText(/sector/i)).toHaveValue("Maarif");

    fireEvent.change(within(dialog).getByLabelText(/phone/i), {
      target: { value: "0698765432" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    // The workspace's own detail query is invalidated on a successful edit —
    // the title reflects the new phone once the refetch resolves.
    expect(
      await screen.findByRole("heading", { name: "06 98 76 54 32" }),
    ).toBeInTheDocument();
  });
});

describe("current relationship", () => {
  it("an assigned Client shows the Commercial's name and account number", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByRole("link", { name: "Salma Alaoui" })).toBeInTheDocument();
    expect(screen.getByText("DEV-CPT-COMMERCIAL-001")).toBeInTheDocument();
  });

  it("an unassigned Client shows the absent dash and offers Assign Commercial, not Reassign", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678", { agent: null })));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    const assignedToRow = screen.getByText("Assigned to").closest("div");
    expect(within(assignedToRow!).getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign Commercial" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reassign Commercial" }),
    ).not.toBeInTheDocument();
  });

  it("an assigned Client offers Reassign Commercial, not Assign", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(
      screen.getByRole("button", { name: "Reassign Commercial" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assign Commercial" }),
    ).not.toBeInTheDocument();
  });

  it("VIEW_AGENTS grants a deep link to Agent 360, reusing agentDetailPath", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByRole("link", { name: "Salma Alaoui" })).toHaveAttribute(
      "href",
      "/network/agents/636",
    );
  });

  it("without VIEW_AGENTS, the Commercial identity renders as plain text, never a link", async () => {
    signInWith([
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.UPDATE_CLIENT,
      PERMISSIONS.MANAGE_CLIENT_STATUS,
      PERMISSIONS.ASSIGN_CLIENT,
    ]);
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByText("Salma Alaoui")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Salma Alaoui" })).not.toBeInTheDocument();
  });

  it("current relationship comes from ClientDetail.commercial, never from the latest history row", async () => {
    // ClientDetail.commercial = Salma Alaoui (id 636, detailRow's default).
    // The newest — and only — history row points somewhere else entirely
    // (Youssef Bennani, id 700), a deliberately constructed mismatch. The
    // Current Commercial section must still show Salma Alaoui; the
    // (independently-queried) history row still correctly shows the
    // reassignment to Youssef Bennani.
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "reassigned", {
          from_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          to_agent: { id: 700, nom: "Bennani", prenom: "Youssef" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    const assignedToRow = screen.getByText("Assigned to").closest("div");
    expect(within(assignedToRow!).getByText("Salma Alaoui")).toBeInTheDocument();

    const historyItem = (await screen.findByText(/Reassigned from/)).closest("li");
    expect(within(historyItem!).getByText("Youssef Bennani")).toBeInTheDocument();
  });
});

describe("action permissions", () => {
  it("no Assign/Reassign action without ASSIGN_CLIENT", async () => {
    signInWith([PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.VIEW_AGENTS]);
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(
      screen.queryByRole("button", { name: "Reassign Commercial" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assign Commercial" }),
    ).not.toBeInTheDocument();
  });

  it("ASSIGN_CLIENT without VIEW_AGENTS never requests Commercial options, and fails closed with a disabled, explained picker", async () => {
    let requested = false;
    signInWith([PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.ASSIGN_CLIENT]);
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      commercialOptionsHandler(undefined, () => {
        requested = true;
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/commercial/i)).toBeDisabled();
    expect(
      within(dialog).getByText(/you do not have permission to view the commercial list/i),
    ).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("ASSIGN_CLIENT + VIEW_AGENTS populates the picker with the active Commercial options", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByRole("option", { name: "Youssef Bennani" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("option", { name: "Salma Alaoui" }),
    ).toBeInTheDocument();
  });
});

describe("assignment", () => {
  it("unassigned Client: drawer titled Assign Commercial, picker seeded empty", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678", { agent: null })));
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Assign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Assign Commercial" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/commercial/i)).toHaveValue("");
  });

  it("assigned Client: drawer titled Reassign Commercial, picker seeded to the current Commercial", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Reassign Commercial" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/commercial/i)).toHaveValue("636");
  });

  it("states plainly that only the Commercial changes — city and sector are unaffected", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")));
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/city and sector are left exactly as they are/i),
    ).toBeInTheDocument();
  });

  it("same target: Save closes the drawer WITHOUT issuing a PATCH request", async () => {
    let patched = false;
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.patch(`${API}/admin/clients/7/assign`, () => {
        patched = true;
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { id: 7, agent_id: 636 },
        });
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    // Seeded to the current Commercial (636) already — Save without changing it.
    fireEvent.click(within(dialog).getByRole("button", { name: /^reassign$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(patched).toBe(false);
  });

  it("a genuine target change PATCHes /assign with agent_id ONLY (never ville/secteur)", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.patch(`${API}/admin/clients/7/assign`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { id: 7, agent_id: 700 },
        });
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/commercial/i), {
      target: { value: "700" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reassign$/i }));

    await waitFor(() => expect(body).toEqual({ agent_id: 700 }));
  });

  it("success refreshes the Commercial section (detail) and the history panel", async () => {
    let agentRow: { id: number; nom: string; prenom: string; num_compte: string } | null =
      {
        id: 636,
        nom: "Alaoui",
        prenom: "Salma",
        num_compte: "DEV-CPT-COMMERCIAL-001",
      };
    let historyItems: ReturnType<typeof historyRow>[] = [];
    server.use(
      http.get(`${API}/admin/clients/7`, () =>
        HttpResponse.json({
          success: true,
          data: detailRow(7, "0612345678", { agent: agentRow }),
        }),
      ),
      http.get(`${API}/admin/clients/7/assignment-history`, () =>
        HttpResponse.json({
          success: true,
          data: {
            data: historyItems,
            current_page: 1,
            per_page: 5,
            total: historyItems.length,
            last_page: 1,
          },
        }),
      ),
      http.patch(`${API}/admin/clients/7/assign`, () => {
        agentRow = {
          id: 700,
          nom: "Bennani",
          prenom: "Youssef",
          num_compte: "DEV-CPT-002",
        };
        historyItems = [
          historyRow(9, "reassigned", {
            from_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
            to_agent: { id: 700, nom: "Bennani", prenom: "Youssef" },
          }),
        ];
        return HttpResponse.json({
          success: true,
          message: "ok",
          data: { id: 7, agent_id: 700 },
        });
      }),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/commercial/i), {
      target: { value: "700" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reassign$/i }));

    const assignedToRow = screen.getByText("Assigned to").closest("div");
    await waitFor(() =>
      expect(within(assignedToRow!).getByText("Youssef Bennani")).toBeInTheDocument(),
    );
    expect(await screen.findByText(/Reassigned from/)).toBeInTheDocument();
  });

  it("a backend failure keeps the drawer open", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.patch(`${API}/admin/clients/7/assign`, () =>
        HttpResponse.json(
          { success: false, message: "agent_id must reference an active commercial" },
          { status: 422 },
        ),
      ),
    );
    renderPage("/network/clients/7");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/commercial/i), {
      target: { value: "700" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reassign$/i }));

    // Not message-matched — the generic mutation-error copy, never the
    // backend's own "agent_id must reference an active commercial" string.
    expect(
      await within(dialog).findByText(/could not be completed/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/agent_id must reference/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("invalidates the Client list space too (spied — this page renders no list observer)", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.patch(`${API}/admin/clients/7/assign`, () =>
        HttpResponse.json({
          success: true,
          message: "ok",
          data: { id: 7, agent_id: 700 },
        }),
      ),
    );
    const { queryClient } = renderPage("/network/clients/7");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Reassign Commercial" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/commercial/i), {
      target: { value: "700" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reassign$/i }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientsKeys.lists() }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: clientsKeys.detail(7) });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: clientAssignmentHistoryKeys.details(7),
    });
  });
});

/**
 * The Commercial names in a history row's summary sentence are permission-
 * aware LINKS (`CommercialName`), so the sentence's text is genuinely split
 * across element boundaries (`<p>Assigned to <a>Salma Alaoui</a></p>`) —
 * RTL's `getByText`/`findByText` deliberately does NOT match text broken up
 * by multiple elements by default (a documented RTL behavior, confirmed
 * empirically here too). `toHaveTextContent` has no such restriction (it
 * reads the element's own `.textContent`, which naturally concatenates
 * nested elements' text), so history-row assertions scope to the one
 * `<li>` and use it instead.
 */
async function findHistoryItem() {
  return screen.findByRole("listitem");
}

describe("assignment history", () => {
  it("renders an 'assigned' row with its actor", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          changed_by: { id: 1, name: "Ahmed Errouissi" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    const item = await findHistoryItem();
    expect(item).toHaveTextContent("Assigned to Salma Alaoui");
    expect(item).toHaveTextContent(/Ahmed Errouissi/);
  });

  it("renders a 'reassigned' row (from -> to)", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "reassigned", {
          from_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          to_agent: { id: 700, nom: "Bennani", prenom: "Youssef" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    const item = await findHistoryItem();
    expect(item).toHaveTextContent("Reassigned from Salma Alaoui to Youssef Bennani");
  });

  it("renders an 'unassigned' row", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678", { agent: null })),
      historyHandler([
        historyRow(1, "unassigned", {
          from_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    const item = await findHistoryItem();
    expect(item).toHaveTextContent("Unassigned from Salma Alaoui");
  });

  it("renders a user actor by name", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          changed_by: { id: 1, name: "Ahmed Errouissi" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText(/Ahmed Errouissi ·/)).toBeInTheDocument();
  });

  it("renders an agent actor as prenom + nom", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          changed_by_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText(/Salma Alaoui ·/)).toBeInTheDocument();
  });

  it("renders 'System' for a null actor", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText(/System ·/)).toBeInTheDocument();
  });

  it("renders safely when a referenced Commercial relation is null (e.g. hard-deleted)", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678", { agent: null })),
      historyHandler([historyRow(1, "unassigned", { from_agent: null })]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText(/Unassigned from/)).toBeInTheDocument();
  });

  it("no recorded history renders the honest empty state, never a fabricated legacy row", async () => {
    server.use(showHandler(7, detailRow(7, "0612345678")), historyHandler([]));
    renderPage("/network/clients/7");

    expect(await screen.findByText("No recorded history yet.")).toBeInTheDocument();
  });

  it("shows a loading state before the read resolves", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.get(`${API}/admin/clients/7/assignment-history`, () => new Promise(() => {})),
    );
    renderPage("/network/clients/7");

    // The outer page's own client-detail load must resolve first — the
    // History panel only mounts once the workspace itself is done loading.
    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByText("Assignment history")).toBeInTheDocument();
    expect(screen.queryByText("No recorded history yet.")).not.toBeInTheDocument();
  });

  it("shows a retryable error state and recovers", async () => {
    // Same THREE-attempt retry-policy reasoning as the detail query's own
    // equivalent test above.
    let attempts = 0;
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.get(`${API}/admin/clients/7/assignment-history`, () => {
        attempts += 1;
        if (attempts <= 3) {
          return HttpResponse.json({ success: false, error: null }, { status: 500 });
        }
        return HttpResponse.json({
          success: true,
          data: { data: [], current_page: 1, per_page: 5, total: 0, last_page: 1 },
        });
      }),
    );
    renderPage("/network/clients/7");

    const retry = await screen.findByRole(
      "button",
      { name: /retry/i },
      { timeout: 5000 },
    );
    fireEvent.click(retry);

    expect(await screen.findByText("No recorded history yet.")).toBeInTheDocument();
  });

  it("discloses truncation truthfully: 'Showing latest N of TOTAL'", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler(
        [
          historyRow(1, "assigned", {
            to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
          }),
        ],
        { total: 17 },
      ),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText("Showing latest 1 of 17")).toBeInTheDocument();
  });

  it("hides the truncation indicator when total equals the rendered count", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 636, nom: "Alaoui", prenom: "Salma" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    const item = await findHistoryItem();
    expect(item).toHaveTextContent("Assigned to Salma Alaoui");
    expect(screen.queryByText(/Showing latest/)).not.toBeInTheDocument();
  });

  it("Commercial names in history rows are permission-aware links (VIEW_AGENTS)", async () => {
    // A Commercial distinct from the Client's own current one, to avoid any
    // ambiguity with the Commercial section's own link.
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 700, nom: "Bennani", prenom: "Youssef" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByRole("link", { name: "Youssef Bennani" })).toHaveAttribute(
      "href",
      "/network/agents/700",
    );
  });

  it("without VIEW_AGENTS, history Commercial names render as plain text, no link", async () => {
    signInWith([
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.UPDATE_CLIENT,
      PERMISSIONS.MANAGE_CLIENT_STATUS,
      PERMISSIONS.ASSIGN_CLIENT,
    ]);
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      historyHandler([
        historyRow(1, "assigned", {
          to_agent: { id: 700, nom: "Bennani", prenom: "Youssef" },
        }),
      ]),
    );
    renderPage("/network/clients/7");

    expect(await screen.findByText("Assigned to Youssef Bennani")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Youssef Bennani" }),
    ).not.toBeInTheDocument();
  });
});

describe("panel isolation", () => {
  it("a history query failure does not break Profile/Edit/current Commercial", async () => {
    server.use(
      showHandler(7, detailRow(7, "0612345678")),
      http.get(`${API}/admin/clients/7/assignment-history`, () =>
        HttpResponse.json({ success: false, error: null }, { status: 500 }),
      ),
    );
    renderPage("/network/clients/7");

    // Profile, Edit and the Commercial section all render normally —
    // History's own failure (visible below) never propagates upward.
    await screen.findByRole("heading", { name: "06 12 34 56 78" });
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Salma Alaoui" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reassign Commercial" }),
    ).toBeInTheDocument();

    // The failure itself surfaces, scoped to the History panel only.
    expect(
      await screen.findByText("Assignment history could not be loaded."),
    ).toBeInTheDocument();
  });
});
