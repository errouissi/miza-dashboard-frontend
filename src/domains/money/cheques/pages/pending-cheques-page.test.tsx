import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { PendingChequesPage } from "./pending-cheques-page";

const API = "http://localhost/api/v1";
const PATH = "/money/cheques/pending";

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

/**
 * One transformed pending-cheque row, exactly as `ChequeController::pending`
 * emits it: `amount` a preformatted decimal STRING, `statute` always
 * `en_attente` (the endpoint's own fixed scope), `agent` the full nested
 * Agent model (only `id`/`nom`/`prenom` read at the mapper boundary).
 */
function chequeRow(
  id: number,
  numCheque: string,
  overrides: Partial<{
    amount: string;
    agent_id: number;
    created_at: string;
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

function pendingHandler(
  rows: ReturnType<typeof chequeRow>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/cheques/pending`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows, meta));
  });
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <PendingChequesPage /> },
      // A stub so the "View" navigation test lands on a real route rather
      // than a router-level 404 — the same convention
      // `create-cheque-page.test.tsx` uses for its own post-navigation stub.
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
  signInWith([PERMISSIONS.VIEW_PENDING_CHEQUES]);
});

describe("pending cheques — flat-paginator contract", () => {
  it("renders rows from the { success, data: <paginator> } envelope", async () => {
    server.use(
      pendingHandler([
        chequeRow(1, "CHQ-001"),
        chequeRow(2, "CHQ-002", { agent: { id: 2, nom: "Tazi", prenom: "Nadia" } }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("CHQ-001")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Nadia Tazi")).toBeInTheDocument();
  });

  it("sends only page and per_page — no filter params at all", async () => {
    let url: URL | undefined;
    server.use(pendingHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("15");
    expect(url?.searchParams.get("statute")).toBeNull();
    expect(url?.searchParams.get("agent_id")).toBeNull();
    expect(url?.searchParams.get("search")).toBeNull();
  });

  it("renders a heading and no console-visible runtime error", async () => {
    server.use(pendingHandler([chequeRow(1, "CHQ-001")]));
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Pending Cheques" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state before the first response resolves", async () => {
    server.use(
      http.get(`${API}/admin/cheques/pending`, async () => {
        await delay(30);
        return HttpResponse.json(pageEnvelope([]));
      }),
    );
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(pendingHandler([]));
    renderPage();

    expect(await screen.findByText(/no cheque is pending approval/i)).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/cheques/pending`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("mapping the transformed row", () => {
  it("renders amount verbatim as the backend's preformatted string, never reformatted", async () => {
    server.use(pendingHandler([chequeRow(1, "CHQ-001", { amount: "1234.56" })]));
    renderPage();

    expect(await screen.findByText("1234.56")).toBeInTheDocument();
  });

  it("renders num_cheque verbatim via formatIdentifier, never money-formatted", async () => {
    server.use(pendingHandler([chequeRow(1, "007")]));
    renderPage();

    expect(await screen.findByText("007")).toBeInTheDocument();
  });

  it("renders created_at through the shared date formatter (DD/MM/YYYY)", async () => {
    server.use(
      pendingHandler([chequeRow(1, "CHQ-001", { created_at: "2026-02-10T09:00:00Z" })]),
    );
    renderPage();

    expect(await screen.findByText("10/02/2026")).toBeInTheDocument();
  });

  it("renders the Pending status label, matching the endpoint's fixed scope", async () => {
    server.use(pendingHandler([chequeRow(1, "CHQ-001")]));
    renderPage();

    expect(await screen.findByText("Pending")).toBeInTheDocument();
  });

  it("reduces the nested agent relation to a '{prenom} {nom}' display name", async () => {
    server.use(
      pendingHandler([
        chequeRow(1, "CHQ-001", { agent: { id: 5, nom: "Chraibi", prenom: "Omar" } }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("Omar Chraibi")).toBeInTheDocument();
  });
});

describe("navigation to the detail page", () => {
  it("navigates to the cheque's detail route on View", async () => {
    server.use(pendingHandler([chequeRow(7, "CHQ-007")]));
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/money/cheques/7"));
  });
});

describe("pagination", () => {
  it("shows the page summary and disables Previous on the first page", async () => {
    server.use(
      pendingHandler([chequeRow(1, "CHQ-001")], undefined, {
        current_page: 1,
        last_page: 3,
        total: 45,
        per_page: 15,
      }),
    );
    renderPage();

    expect(await screen.findByText("Page 1 of 3 · 45 cheques")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("advances the page param on Next", async () => {
    let url: URL | undefined;
    server.use(
      pendingHandler([chequeRow(1, "CHQ-001")], (u) => (url = u), {
        current_page: 1,
        last_page: 3,
        total: 45,
      }),
    );
    renderPage();
    await screen.findByText("Page 1 of 3 · 45 cheques");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
  });

  it("omits the pagination footer entirely for a single page", async () => {
    server.use(pendingHandler([chequeRow(1, "CHQ-001")], undefined, { last_page: 1 }));
    renderPage();

    await screen.findByText("CHQ-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
