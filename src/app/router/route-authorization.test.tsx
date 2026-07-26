import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { VILLES_PATH } from "@/domains/reference/villes";
import { SECTEURS_PATH } from "@/domains/reference/secteurs";
import { PRODUCTS_PATH } from "@/domains/reference/products";
import { ADMINS_PATH } from "@/domains/network/admins";
import { MANAGERS_PATH } from "@/domains/network/managers";
import { COMMERCIALS_PATH } from "@/domains/network/commercials";
import { CLIENTS_PATH } from "@/domains/network/clients";
import { AGENT_ONBOARDING_PATH } from "@/domains/network/agent-onboarding";
import {
  CHEQUES_PATH,
  CHEQUES_NEW_PATH,
  CHEQUES_PENDING_PATH,
  chequeDetailPath,
} from "@/domains/money/cheques";
import {
  DEPOSITS_PATH,
  DEPOSIT_NEW_PATH,
  depositDetailPath,
} from "@/domains/money/deposits";
import {
  DEBT_PAYMENTS_PATH,
  DEBT_PAYMENTS_NEW_PATH,
} from "@/domains/money/debt-payments";
import {
  AGENT_STOCK_RETURNS_PATH,
  AGENT_STOCK_RETURN_NEW_PATH,
  agentStockReturnDetailPath,
} from "@/domains/stock/agent-stock-returns";
import { routes } from "./routes";

/**
 * Route-level authorization (FTA §5, §6, §11).
 *
 * The three states this milestone must keep distinct:
 *   unauthenticated          -> /login, return path preserved
 *   authenticated + allowed  -> the page
 *   authenticated + refused  -> the calm 403, SESSION INTACT, no login redirect
 *
 * The third is the one that regresses quietly: treating a refusal as expiry logs
 * an operator out for clicking one thing they lacked a permission for.
 */
const API = "http://localhost/api/v1";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const permittedSession = {
  token: "tok",
  user: { ...baseUser, permissions: [PERMISSIONS.ACCESS_DASHBOARD] },
};

const unpermittedSession = {
  token: "tok",
  user: { ...baseUser, permissions: [] as string[] },
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function emptyVillesList() {
  server.use(
    http.get(`${API}/admin/villes`, () =>
      HttpResponse.json({
        data: [],
        links: {},
        meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 },
      }),
    ),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("protected route: authenticated and permitted", () => {
  it("renders the page", async () => {
    emptyVillesList();
    sessionManager.start(permittedSession);
    renderAt(VILLES_PATH);

    expect(await screen.findByRole("heading", { name: /cities/i })).toBeInTheDocument();
  });
});

describe("protected route: authenticated but NOT permitted", () => {
  it("renders the calm 403 instead of the page", async () => {
    sessionManager.start(unpermittedSession);
    renderAt(VILLES_PATH);

    expect(await screen.findByText(/accès refusé/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /cities/i })).not.toBeInTheDocument();
  });

  it("does NOT redirect to login", () => {
    sessionManager.start(unpermittedSession);
    const router = renderAt(VILLES_PATH);

    expect(router.state.location.pathname).toBe(VILLES_PATH);
    expect(router.state.location.pathname).not.toBe("/login");
  });

  it("does NOT terminate the session", () => {
    // A 403 is not expiry. The operator stays logged in.
    sessionManager.start(unpermittedSession);
    renderAt(VILLES_PATH);

    expect(sessionManager.getSnapshot()).not.toBeNull();
    expect(sessionManager.getSnapshot()?.token).toBe("tok");
  });

  it("keeps the shell usable, with a way out", async () => {
    sessionManager.start(unpermittedSession);
    renderAt(VILLES_PATH);

    expect(await screen.findByText(/accès refusé/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accueil/i })).toBeInTheDocument();
  });

  it("never fetches the data behind a refused route", async () => {
    // The guard sits ABOVE the page, so the query never mounts. If this regresses,
    // a refused operator still triggers the request — and MSW's
    // onUnhandledRequest:"error" turns that into a failure rather than a silent leak.
    sessionManager.start(unpermittedSession);
    renderAt(VILLES_PATH);

    await screen.findByText(/accès refusé/i);
  });
});

describe("protected route: unauthenticated", () => {
  it("redirects to login preserving the return path", () => {
    const router = renderAt(VILLES_PATH);

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(VILLES_PATH)}`);
  });

  it("does not render the page or the 403", () => {
    renderAt(VILLES_PATH);

    expect(screen.queryByRole("heading", { name: /cities/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/accès refusé/i)).not.toBeInTheDocument();
  });
});

describe("unknown permissions fail safe", () => {
  it("refuses a session whose permissions are unrelated to the route", async () => {
    sessionManager.start({
      token: "tok",
      user: { ...baseUser, permissions: ["some-unrelated-permission"] },
    });
    renderAt(VILLES_PATH);

    expect(await screen.findByText(/accès refusé/i)).toBeInTheDocument();
  });

  it("refuses rather than allows when a route declares no permission", async () => {
    // Fails CLOSED. A route assembled without a declared permission is a
    // forgotten declaration, and defaulting to "allow" would make that
    // forgetting invisible.
    const { withPermissionGuardsForTest } = await import("./routes");
    const guarded = withPermissionGuardsForTest([
      { path: "/undeclared", element: <p>secret</p> },
    ]);

    sessionManager.start(permittedSession);
    const router = createMemoryRouter(guarded, { initialEntries: ["/undeclared"] });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("still refuses an undeclared route when the session grants an EMPTY permission", async () => {
    // The adversarial case behind the unconditional refusal. An earlier shape
    // passed `permission ?? ""` to the resolver, which refused only because no
    // permission is named "" — a coincidence, not a decision. A malformed grant
    // carrying "" would have opened every undeclared route at once.
    const { withPermissionGuardsForTest } = await import("./routes");
    const guarded = withPermissionGuardsForTest([
      { path: "/undeclared", element: <p>secret</p> },
    ]);

    sessionManager.start({
      token: "tok",
      user: { ...baseUser, permissions: ["", PERMISSIONS.ACCESS_DASHBOARD] },
    });
    const router = createMemoryRouter(guarded, { initialEntries: ["/undeclared"] });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText(/accès refusé/i)).toBeInTheDocument();
  });
});

describe("every contributed domain route is guarded", () => {
  // Parameterised so a new resource inherits the authorization contract by being
  // added to this list — not by someone remembering to write three more tests.
  // MANAGERS_PATH and COMMERCIALS_PATH are both guarded by `view-agents`, not
  // `access-dashboard` — the same string, since both endpoints sit behind one
  // controller and one permission set. CLIENTS_PATH is guarded by
  // `view-clients` — its own permission, a separate controller entirely.
  // AGENT_ONBOARDING_PATH (M3.6) is guarded by `create-agent` — its own
  // permission, on its own dedicated domain (ADR-0012), not `view-agents`.
  // CHEQUES_PATH (M4.2 Phase 2) is guarded by `view-cheques` — its own
  // permission, the first resource outside Network. CHEQUES_NEW_PATH
  // (M4.2 Phase 3A) is guarded by `create-cheque`, a DIFFERENT permission
  // from the list route it sits beside — mirroring `POST /admin/cheques`'
  // own, separate check. CHEQUES_PENDING_PATH (M4.2 Phase 3B) is guarded by
  // `view-pending-cheques`, its own permission distinct from `view-cheques`,
  // mirroring `GET /admin/cheques/pending`'s own separate check.
  // `chequeDetailPath(1)` (Phase 3B) is guarded by `view-cheques` — the SAME
  // permission as the list route, mirroring `GET /admin/cheques/{id}`'s own
  // check — exercised via a concrete id since the route itself is the
  // dynamic pattern `/money/cheques/:id`.
  // DEPOSITS_PATH (M4.3 Phase 1) is guarded by `view-depos` — its own
  // permission, the second Money resource, mirroring `GET /admin/depos`'s
  // own separate check. `depositDetailPath(1)` (Phase 2) is guarded by the
  // SAME `view-depos` — mirroring `GET /admin/depos/{depo}`'s own check,
  // which shares its permission with the list, unlike Cheques' detail
  // route (also `view-cheques`, but a genuinely separate backend check from
  // its own list). DEPOSIT_NEW_PATH (Phase 4) is guarded by `create-depo` —
  // a DIFFERENT permission from the list route it sits beside, mirroring
  // `POST /admin/depos`'s own, separate check — the same pattern
  // CHEQUES_NEW_PATH already established for Cheques.
  // DEBT_PAYMENTS_PATH/DEBT_PAYMENTS_NEW_PATH (roadmap M4, the third and
  // final Money resource) are BOTH guarded by the SAME `debt_cash`
  // permission — verified fresh from source (`routes/api.php:167-170`):
  // `GET`/`POST /admin/debt-payments` carry the identical
  // `permission:debt_cash` check, unlike Cheques'/Deposits' own split
  // view/create vocabularies. No detail path exists to test — the backend
  // route is commented out.
  // AGENT_STOCK_RETURNS_PATH/AGENT_STOCK_RETURN_NEW_PATH/
  // `agentStockReturnDetailPath(1)` (roadmap M5, Phase 1 — the first Stock
  // resource) are guarded by `view-agent-stock-return`/
  // `create-agent-stock-return`/`view-agent-stock-return` respectively —
  // verified fresh from source: the backend gates these in FormRequests
  // (`authorize()`), not route middleware, a genuine departure from every
  // domain above, but this frontend guard still exercises the same
  // permission strings regardless of which layer enforces them server-side.
  // `unpermittedSession` holds nothing at all, so it exercises every gate
  // identically.
  const domainPaths = [
    VILLES_PATH,
    SECTEURS_PATH,
    PRODUCTS_PATH,
    ADMINS_PATH,
    MANAGERS_PATH,
    COMMERCIALS_PATH,
    CLIENTS_PATH,
    AGENT_ONBOARDING_PATH,
    CHEQUES_PATH,
    CHEQUES_NEW_PATH,
    CHEQUES_PENDING_PATH,
    chequeDetailPath(1),
    DEPOSITS_PATH,
    DEPOSIT_NEW_PATH,
    depositDetailPath(1),
    DEBT_PAYMENTS_PATH,
    DEBT_PAYMENTS_NEW_PATH,
    AGENT_STOCK_RETURNS_PATH,
    AGENT_STOCK_RETURN_NEW_PATH,
    agentStockReturnDetailPath(1),
  ];

  it.each(domainPaths)("refuses %s without the permission", async (path) => {
    sessionManager.start(unpermittedSession);
    const router = renderAt(path);

    expect(await screen.findByText(/accès refusé/i)).toBeInTheDocument();
    // Not a login redirect, and the session survives.
    expect(router.state.location.pathname).toBe(path);
    expect(sessionManager.getSnapshot()).not.toBeNull();
  });

  it.each(domainPaths)("redirects %s to login when unauthenticated", (path) => {
    const router = renderAt(path);

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(path)}`);
  });
});

describe("session termination still works from a domain route", () => {
  it("a 401 from the villes list terminates the session", async () => {
    server.use(
      http.get(`${API}/admin/villes`, () =>
        HttpResponse.json({ message: "Unauthenticated." }, { status: 401 }),
      ),
    );

    sessionManager.start(permittedSession);
    renderAt(VILLES_PATH);

    await waitFor(() => {
      expect(sessionManager.getSnapshot()).toBeNull();
    });
  });
});
