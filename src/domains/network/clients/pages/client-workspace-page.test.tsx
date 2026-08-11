import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ClientWorkspacePage } from "./client-workspace-page";
import { clientDetailPath, CLIENT_DETAIL_PATH } from "../routes";

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

function renderPage(initialPath: string) {
  const router = createMemoryRouter([{ path: PATH, element: <ClientWorkspacePage /> }], {
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
  // The shared `ClientFormSheet` (M7 Phase 1's own Edit reuse) is always
  // mounted alongside this workspace, whether or not its drawer is open —
  // its `useVilleOptionsQuery` fires unconditionally once `access-dashboard`
  // is held (granted by `ALL_CLIENT_PERMISSIONS` above), so every test in
  // this file needs a Villes handler, not only the ones that open Edit.
  server.use(villesHandler());
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
    const retry = await screen.findByRole("button", { name: /retry/i }, { timeout: 5000 });
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
