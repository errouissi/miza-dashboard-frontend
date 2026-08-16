import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { PanelBoundary } from "@/shared/components/patterns/panel-boundary";
import { PendingDepositsWidget } from "../components/pending-deposits-widget";
import { OverdueGrattageWidget } from "../components/overdue-grattage-widget";
import { OverviewPage } from "./overview-page";

const API = "http://localhost/api/v1";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const ALL_OVERVIEW_PERMISSIONS = [
  PERMISSIONS.VIEW_CHEQUES,
  PERMISSIONS.VIEW_DEPOSITS,
  PERMISSIONS.ACCESS_DASHBOARD,
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

function renderPage() {
  render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <OverviewPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// -------------------------------------------------------------- Cheques

function chequeRow(id: number, overrides: Partial<{ amount: string }> = {}) {
  return {
    id,
    amount: "1500.00",
    num_cheque: `CHQ-${id}`,
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

function chequesEnvelope(
  rows: ReturnType<typeof chequeRow>[],
  meta: Partial<{ total: number; per_page: number }> = {},
) {
  return {
    success: true,
    data: {
      data: rows,
      current_page: 1,
      per_page: meta.per_page ?? 5,
      total: meta.total ?? rows.length,
      last_page: 1,
    },
  };
}

function chequesHandler(
  rows: ReturnType<typeof chequeRow>[] = [],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof chequesEnvelope>[1],
) {
  return http.get(`${API}/admin/cheques`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(chequesEnvelope(rows, meta));
  });
}

// -------------------------------------------------------------- Deposits

function depositRow(id: number, overrides: Partial<{ amount: number }> = {}) {
  return {
    id,
    amount: 1200,
    status: "pending" as const,
    type: "rapped" as const,
    method: "bank" as const,
    receipt: `REC-${id}`,
    proof_url: null,
    date: "2026-02-10 09:00",
    agent: {
      id,
      full_name: `Deposit Agent ${id}`,
      account_number: "MG0001",
      photo: null,
    },
    created_by: "Ahmed Errouissi",
    reject_reason: null,
    validated_by: null,
    validated_at: null,
    bank_name: null,
    proof_type: "bank_receipt",
    ...overrides,
  };
}

function depositsEnvelope(
  rows: ReturnType<typeof depositRow>[],
  meta: Partial<{ total: number }> = {},
) {
  return {
    data: rows,
    links: {},
    meta: {
      current_page: 1,
      per_page: 20,
      total: meta.total ?? rows.length,
      last_page: 1,
    },
  };
}

function depositsHandler(
  rows: ReturnType<typeof depositRow>[] = [],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof depositsEnvelope>[1],
) {
  return http.get(`${API}/admin/depos`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(depositsEnvelope(rows, meta));
  });
}

// ---------------------------------------------------------- Grattage Invoices

function invoiceRow(id: number, overrides: Partial<{ total_amount: string }> = {}) {
  return {
    id,
    status: "overdue" as const,
    total_amount: "250.00",
    sold_at: "2026-08-01T09:00:00.000000Z",
    due_at: "2026-08-02T12:00:00.000000Z",
    declared_at: null,
    deposit_id: null,
    agent: { id: 636, nom: "Alaoui", prenom: "Salma", num_compte: "CM0001" },
    client: { id: 1, phone: "0600100001" },
    ...overrides,
  };
}

function invoicesEnvelope(
  rows: ReturnType<typeof invoiceRow>[],
  meta: Partial<{ total: number }> = {},
) {
  return {
    success: true,
    data: {
      data: rows,
      current_page: 1,
      per_page: 15,
      total: meta.total ?? rows.length,
      last_page: 1,
    },
  };
}

function grattageHandler(
  rows: ReturnType<typeof invoiceRow>[] = [],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof invoicesEnvelope>[1],
) {
  return http.get(`${API}/admin/grattage-invoices`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(invoicesEnvelope(rows, meta));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_OVERVIEW_PERMISSIONS);
  server.use(chequesHandler(), depositsHandler(), grattageHandler());
});

describe("Overview page", () => {
  it("renders at the app's index route instead of a placeholder", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  it("mounts all three widgets independently, side by side", async () => {
    renderPage();

    expect(await screen.findByText("Pending Cheques")).toBeInTheDocument();
    expect(screen.getByText("Pending Deposits")).toBeInTheDocument();
    expect(screen.getByText("Overdue Grattage Invoices")).toBeInTheDocument();
  });
});

describe("Pending Cheques widget", () => {
  it("hides the widget and never requests /admin/cheques without VIEW_CHEQUES", async () => {
    let requested = false;
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(chequesHandler([], () => (requested = true)));
    renderPage();

    await screen.findByText("Pending Deposits");
    expect(screen.queryByText("Pending Cheques")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("requests status=en_attente and per_page=5", async () => {
    let url: URL | undefined;
    server.use(chequesHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("statute")).toBe("en_attente");
    expect(url?.searchParams.get("per_page")).toBe("5");
  });

  it("shows a loading state, then the populated rows", async () => {
    server.use(chequesHandler([chequeRow(1), chequeRow(2)]));
    renderPage();

    expect(await screen.findByText("CHQ-1")).toBeInTheDocument();
    expect(screen.getByText("CHQ-2")).toBeInTheDocument();
    // The decimal-cast STRING, rendered verbatim.
    expect(screen.getAllByText("1500.00")).toHaveLength(2);
  });

  it("shows the empty state, not an error, when there are no pending cheques", async () => {
    server.use(chequesHandler([]));
    renderPage();

    expect(await screen.findByText("No pending cheques.")).toBeInTheDocument();
  });

  it("shows a retryable error state and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/cheques`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(chequesEnvelope([chequeRow(1)])),
      ),
    );
    renderPage();

    const alert = await within(
      screen.getByText("Pending Cheques").closest("section")!,
    ).findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("CHQ-1")).toBeInTheDocument();
  });

  it("discloses the real total when it exceeds the 5 rendered rows", async () => {
    server.use(chequesHandler([chequeRow(1)], undefined, { total: 12 }));
    renderPage();

    expect(await screen.findByText("Showing 1 of 12")).toBeInTheDocument();
  });

  it("links to the existing pending-cheques workflow via CHEQUES_PENDING_PATH", async () => {
    renderPage();

    const section = (await screen.findByText("Pending Cheques")).closest("section")!;
    expect(within(section).getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/money/cheques/pending",
    );
  });
});

describe("Pending Deposits widget", () => {
  it("hides the widget and never requests /admin/depos without VIEW_DEPOSITS", async () => {
    let requested = false;
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(depositsHandler([], () => (requested = true)));
    renderPage();

    await screen.findByText("Pending Cheques");
    expect(screen.queryByText("Pending Deposits")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("requests status=pending (no per_page control exists on this endpoint)", async () => {
    let url: URL | undefined;
    server.use(depositsHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("pending");
    expect(url?.searchParams.get("per_page")).toBeNull();
  });

  it("renders at most 5 rows even when the backend returns more", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => depositRow(i + 1));
    server.use(depositsHandler(rows, undefined, { total: 8 }));
    renderPage();

    await screen.findByText(/Deposit Agent 1/);
    expect(screen.queryByText(/Deposit Agent 6/)).not.toBeInTheDocument();
    expect(screen.getByText("Showing 5 of 8")).toBeInTheDocument();
  });

  it("shows the empty state when there are no pending deposits", async () => {
    server.use(depositsHandler([]));
    renderPage();

    expect(await screen.findByText("No pending deposits.")).toBeInTheDocument();
  });

  it("shows a retryable error state and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/depos`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, error: null }, { status: 500 })
          : HttpResponse.json(depositsEnvelope([depositRow(1)])),
      ),
    );
    renderPage();

    const alert = await within(
      screen.getByText("Pending Deposits").closest("section")!,
    ).findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(/Deposit Agent 1/)).toBeInTheDocument();
  });

  it("links to the existing Deposits page, filtered via the list page's own ?status= convention", async () => {
    renderPage();

    const section = (await screen.findByText("Pending Deposits")).closest("section")!;
    expect(within(section).getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/money/deposits?status=pending",
    );
  });

  it("renders the deposit reference, Agent identity, type and amount as a real number", async () => {
    server.use(depositsHandler([depositRow(7, { amount: 1234 })]));
    renderPage();

    const row = (await screen.findByText("REC-7")).closest("li")!;
    expect(within(row).getByText(/Deposit Agent 7/)).toBeInTheDocument();
    expect(within(row).getByText(/Rapped/)).toBeInTheDocument();
    // A real number, formatted through MoneyAmount — not the decimal-cast
    // STRING convention Cheques'/Grattage's own amounts use.
    expect(within(row).getByText(/1 234,00/)).toBeInTheDocument();
  });
});

describe("Overdue Grattage Invoices widget", () => {
  it("hides the widget and never requests /admin/grattage-invoices without ACCESS_DASHBOARD", async () => {
    let requested = false;
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.VIEW_DEPOSITS]);
    server.use(grattageHandler([], () => (requested = true)));
    renderPage();

    await screen.findByText("Pending Cheques");
    expect(screen.queryByText("Overdue Grattage Invoices")).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("requests status=overdue (no per_page control exists on the general query)", async () => {
    let url: URL | undefined;
    server.use(grattageHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("status")).toBe("overdue");
    expect(url?.searchParams.get("per_page")).toBeNull();
  });

  it("renders at most 5 rows even when the backend returns more", async () => {
    const rows = Array.from({ length: 7 }, (_, i) => invoiceRow(i + 1));
    server.use(grattageHandler(rows, undefined, { total: 7 }));
    renderPage();

    await screen.findByRole("link", { name: "Invoice #1" });
    expect(screen.queryByRole("link", { name: "Invoice #6" })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 5 of 7")).toBeInTheDocument();
  });

  it("shows the empty state when there are no overdue invoices", async () => {
    server.use(grattageHandler([]));
    renderPage();

    expect(await screen.findByText("No overdue Grattage invoices.")).toBeInTheDocument();
  });

  it("shows a retryable error state and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/grattage-invoices`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, error: null }, { status: 500 })
          : HttpResponse.json(invoicesEnvelope([invoiceRow(9)])),
      ),
    );
    renderPage();

    const alert = await within(
      screen.getByText("Overdue Grattage Invoices").closest("section")!,
    ).findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("link", { name: "Invoice #9" })).toBeInTheDocument();
  });

  it("renders Commercial, Client, amount and due date, and links each invoice via the existing detail path helper", async () => {
    server.use(grattageHandler([invoiceRow(42, { total_amount: "999.00" })]));
    renderPage();

    const link = await screen.findByRole("link", { name: "Invoice #42" });
    expect(link).toHaveAttribute("href", "/grattage/invoices/42");
    const row = link.closest("li")!;
    expect(within(row).getByText(/Salma Alaoui/)).toBeInTheDocument();
    expect(within(row).getByText(/0600100001/)).toBeInTheDocument();
    expect(within(row).getByText("999.00")).toBeInTheDocument();
    expect(within(row).getByText("Overdue")).toBeInTheDocument();
  });

  it("links the widget's own View all to the Grattage Invoices page, filtered via its ?status= convention", async () => {
    renderPage();

    const section = (await screen.findByText("Overdue Grattage Invoices")).closest(
      "section",
    )!;
    expect(within(section).getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/grattage/invoices?status=overdue",
    );
  });
});

describe("permission combinations", () => {
  it("ACCESS_DASHBOARD only: Grattage widget renders, Cheques/Deposits absent", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    renderPage();

    expect(await screen.findByText("Overdue Grattage Invoices")).toBeInTheDocument();
    expect(screen.queryByText("Pending Cheques")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Deposits")).not.toBeInTheDocument();
  });

  it("VIEW_CHEQUES only: Cheques widget renders, the other two are absent", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES]);
    renderPage();

    expect(await screen.findByText("Pending Cheques")).toBeInTheDocument();
    expect(screen.queryByText("Pending Deposits")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue Grattage Invoices")).not.toBeInTheDocument();
  });

  it("VIEW_DEPOSITS only: Deposits widget renders, the other two are absent", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS]);
    renderPage();

    expect(await screen.findByText("Pending Deposits")).toBeInTheDocument();
    expect(screen.queryByText("Pending Cheques")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue Grattage Invoices")).not.toBeInTheDocument();
  });

  it("all three permissions: all three widgets render", async () => {
    renderPage();

    expect(await screen.findByText("Pending Cheques")).toBeInTheDocument();
    expect(screen.getByText("Pending Deposits")).toBeInTheDocument();
    expect(screen.getByText("Overdue Grattage Invoices")).toBeInTheDocument();
  });

  it("no relevant permissions: the shell still renders, zero queue requests fire, and the heading remains", async () => {
    let chequesRequested = false;
    let depositsRequested = false;
    let grattageRequested = false;
    signInWith([]);
    server.use(
      chequesHandler([], () => (chequesRequested = true)),
      depositsHandler([], () => (depositsRequested = true)),
      grattageHandler([], () => (grattageRequested = true)),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByText("Pending Cheques")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Deposits")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue Grattage Invoices")).not.toBeInTheDocument();
    expect(chequesRequested).toBe(false);
    expect(depositsRequested).toBe(false);
    expect(grattageRequested).toBe(false);
  });
});

describe("isolation", () => {
  it("a Cheques query failure does not block Deposits or Grattage from rendering their own data", async () => {
    server.use(
      http.get(`${API}/admin/cheques`, () =>
        HttpResponse.json({ success: false, error: null }, { status: 500 }),
      ),
      depositsHandler([depositRow(1)]),
      grattageHandler([invoiceRow(9)]),
    );
    renderPage();

    expect(await screen.findByText(/Deposit Agent 1/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Invoice #9" })).toBeInTheDocument();
  });

  it("a Deposits query failure does not block Cheques or Grattage from rendering their own data", async () => {
    server.use(
      chequesHandler([chequeRow(1)]),
      http.get(`${API}/admin/depos`, () =>
        HttpResponse.json({ success: false, error: null }, { status: 500 }),
      ),
      grattageHandler([invoiceRow(9)]),
    );
    renderPage();

    expect(await screen.findByText("CHQ-1")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Invoice #9" })).toBeInTheDocument();
  });

  it("a Grattage query failure does not block Cheques or Deposits from rendering their own data", async () => {
    server.use(
      chequesHandler([chequeRow(1)]),
      depositsHandler([depositRow(1)]),
      http.get(`${API}/admin/grattage-invoices`, () =>
        HttpResponse.json({ success: false, error: null }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByText("CHQ-1")).toBeInTheDocument();
    expect(await screen.findByText(/Deposit Agent 1/)).toBeInTheDocument();
  });

  it("a render crash in one widget is contained by its own PanelBoundary — the other two survive", async () => {
    // Mirrors OverviewPage's own composition exactly (one PanelBoundary per
    // widget, real Deposits/Grattage widgets, unmocked) with a genuinely
    // throwing component standing in for Cheques — proves the actual
    // per-widget boundary structure this page uses is crash-safe, without
    // module-mocking the real widget (which would also require resetting
    // the module graph and re-breaking the shared `sessionManager`
    // singleton `beforeEach` already primed for this test file).
    // `PanelBoundary`'s own generic isolation mechanism is already proven
    // in `panel-boundary.test.tsx` — this test's own concern is narrower:
    // that OverviewPage wraps each widget in its OWN boundary, not one
    // shared boundary around all three.
    function Bomb(): never {
      throw new Error("boom");
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(depositsHandler([depositRow(1)]), grattageHandler([invoiceRow(9)]));

    render(
      <MemoryRouter>
        <QueryClientProvider client={createQueryClient()}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PanelBoundary>
              <Bomb />
            </PanelBoundary>
            <PanelBoundary>
              <PendingDepositsWidget />
            </PanelBoundary>
            <PanelBoundary>
              <OverdueGrattageWidget />
            </PanelBoundary>
          </div>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Deposit Agent 1/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Invoice #9" })).toBeInTheDocument();
    expect(screen.getByText("This section could not be loaded.")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
