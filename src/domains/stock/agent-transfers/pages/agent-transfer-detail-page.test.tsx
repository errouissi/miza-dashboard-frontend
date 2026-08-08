import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentTransferDetailPage } from "./agent-transfer-detail-page";

const API = "http://localhost/api/v1";
const TRANSFERS_PATH = "/stock/agent-transfers";
const DETAIL_PATTERN = "/stock/agent-transfers/:id";

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

const ALL_PERMISSIONS = [
  PERMISSIONS.VIEW_AGENT_TRANSFERS,
  PERMISSIONS.VALIDATE_AGENT_TRANSFER,
  PERMISSIONS.CREATE_AGENT_TRANSFER_LINE,
  PERMISSIONS.UPDATE_AGENT_TRANSFER_LINE,
  PERMISSIONS.DELETE_AGENT_TRANSFER_LINE,
];

type LineRow = {
  id: number;
  transfer_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

function lineRow(overrides: Partial<LineRow> = {}): LineRow {
  return {
    id: 1,
    transfer_id: 1,
    product_id: 1,
    quantity: 5,
    unit_cost: "10.00",
    notes: null,
    created_at: "2026-07-25T09:00:00Z",
    updated_at: "2026-07-25T09:00:00Z",
    product: { id: 1, name: "IAM 10 DH" },
    ...overrides,
  };
}

/** `AgentTransferResource`'s own row shape, re-verified fresh from source. */
function showEnvelope(
  overrides: Partial<{
    id: number;
    transfer_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    notes: string | null;
    transfer_date: string | null;
    approved_by: number | null;
    approved_at: string | null;
    lines: LineRow[];
    validation_summary: {
      line_count: number;
      total_quantity: number;
      montant: string;
    };
  }> = {},
) {
  const lines = overrides.lines ?? [];
  return {
    data: {
      id: 1,
      transfer_number: "TRF-001",
      status: "draft" as const,
      montant: "50.00",
      notes: null,
      transfer_date: "2026-07-20",
      admin_id: 1,
      manager_id: 20,
      commercial_id: 10,
      approved_by: null,
      approved_at: null,
      created_at: "2026-07-25T09:00:00Z",
      updated_at: "2026-07-25T09:00:00Z",
      creator: { id: 1, name: "Ahmed Errouissi" },
      manager: { id: 20, nom: "Bennani", prenom: "Youssef" },
      commercial: { id: 10, nom: "Alaoui", prenom: "Sara" },
      approver: null,
      lines,
      validation_summary: {
        line_count: lines.length,
        total_quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        montant: "50.00",
      },
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/agent-transfers/${id}`, () =>
    HttpResponse.json(envelope),
  );
}

function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/agent-transfers/${id}`, () => {
    const envelope = envelopes[Math.min(call, envelopes.length - 1)];
    call += 1;
    return HttpResponse.json(envelope);
  });
}

function failingAfterFirstShowHandler(
  id: number,
  firstEnvelope: ReturnType<typeof showEnvelope>,
) {
  let call = 0;
  return http.get(`${API}/admin/agent-transfers/${id}`, () => {
    call += 1;
    if (call === 1) return HttpResponse.json(firstEnvelope);
    return HttpResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 },
    );
  });
}

/**
 * `GET /admin/managers/{manager}/stock` — the "add line" picker's own
 * source of truth now (replaces the generic, unfiltered
 * `GET /admin/products` this page used before the endpoint existed).
 * Scoped to manager id 20, matching every `showEnvelope`'s own default
 * `manager_id`.
 */
function managerStockHandler() {
  return http.get(`${API}/admin/managers/20/stock`, () =>
    HttpResponse.json([
      {
        product_id: 1,
        name: "IAM 10 DH",
        operator: "IAM",
        value: 10,
        available_quantity: 50,
      },
      {
        product_id: 2,
        name: "INWI 20 DH",
        operator: "INWI",
        value: 20,
        available_quantity: 30,
      },
    ]),
  );
}

/**
 * `GET /admin/agents/{id}/grattage-outstanding` (M6 Phase 3) — the
 * recipient COMMERCIAL's own restock gate. Scoped to agent id 10,
 * matching every `showEnvelope`'s own default `commercial_id`. Registered
 * as a CLEAR default in `beforeEach` below so every pre-existing test in
 * this file (none of which override `commercial_id`) keeps working
 * unmodified; the tests that specifically exercise the gate override it
 * with their own `server.use(...)`.
 */
function grattageOutstandingEnvelope(
  agentId: number,
  gate: {
    blocked: boolean;
    reason: "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE" | null;
  },
) {
  return {
    success: true,
    data: {
      agent: {
        id: agentId,
        nom: "Alaoui",
        prenom: "Sara",
        num_cin: "CIN010",
        num_compte: "CM0010",
        role: "commercial",
        status: "active",
        manager: { id: 20, nom: "Bennani", prenom: "Youssef" },
      },
      summary: {
        required_total: "0.00",
        pending_total: "0.00",
        overdue_total: "0.00",
        invoice_count: 0,
        oldest_due_at: null,
      },
      restock_gate: gate,
      invoices: [],
    },
  };
}

function grattageOutstandingHandler(
  agentId: number,
  gate: {
    blocked: boolean;
    reason: "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE" | null;
  } = { blocked: false, reason: null },
) {
  return http.get(`${API}/admin/agents/${agentId}/grattage-outstanding`, () =>
    HttpResponse.json(grattageOutstandingEnvelope(agentId, gate)),
  );
}

function renderPage(initialPath: string, queryClient: QueryClient = createQueryClient()) {
  const router = createMemoryRouter(
    [
      { path: DETAIL_PATTERN, element: <AgentTransferDetailPage /> },
      { path: TRANSFERS_PATH, element: <p>Agent Transfers list</p> },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_PERMISSIONS);
  // Default: a clear gate for agent id 10 — see the handler's own docblock.
  server.use(grattageOutstandingHandler(10));
});

describe("rendering every field show() returns", () => {
  it("renders transfer number, status, manager, commercial, amount, dates, notes", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, notes: "Restocking" })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByRole("heading", { name: /TRF-001/ })).toBeInTheDocument();
    expect(screen.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("50.00 DH")).toBeInTheDocument();
    expect(screen.getByText("Restocking")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders lines when present", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, lines: [lineRow()] })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("IAM 10 DH")).toBeInTheDocument();
  });
});

describe("status-dependent sections", () => {
  it("shows no Processed section for a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("heading", { name: /TRF-001/ });
    expect(screen.queryByRole("heading", { name: "Processed" })).not.toBeInTheDocument();
  });

  it("shows the Processed section for a validated transfer", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "validated",
          approved_by: 1,
          approved_at: "2026-07-26T10:00:00Z",
        }),
      ),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("shows not-found copy on a 404", async () => {
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "TRANSFER_NOT_FOUND",
            message: "Agent transfer not found.",
          },
          { status: 404 },
        ),
      ),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status gating", () => {
  it("shows Validate for a draft with at least one line, when the permission is held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
  });

  it("disables Validate on an empty draft, with an explanatory hint", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByText("Add a line first.")).toBeInTheDocument();
  });

  it("hides Validate without the permission", async () => {
    signInWith([PERMISSIONS.VIEW_AGENT_TRANSFERS]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("heading", { name: /TRF-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("hides Validate for an already-validated transfer, even with the permission held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("heading", { name: /TRF-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("renders lines read-only (no Add/Edit/Remove) once no longer a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated", lines: [lineRow()] })),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByText("IAM 10 DH");
    expect(screen.queryByRole("button", { name: "Add line" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});

describe("adding a line", () => {
  it("sends the exact wire field names and refetches on success", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/lines`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
    );
    renderPage("/stock/agent-transfers/1");

    const productSelect = await screen.findByLabelText("Add product");
    await within(productSelect).findByRole("option", { name: "IAM 10 DH" });
    fireEvent.change(productSelect, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    await waitFor(() =>
      expect(body).toEqual({ product_id: 1, quantity: 5, unit_cost: "10" }),
    );
    expect(await screen.findByText("IAM 10 DH")).toBeInTheDocument();
  });

  it("shows domain-owned copy from the error-code registry on a duplicate product", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/lines`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "TRANSFER_LINE_DUPLICATE_PRODUCT",
            message: "This product is already on this transfer line.",
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1");

    const productSelect = await screen.findByLabelText("Add product");
    await within(productSelect).findByRole("option", { name: "IAM 10 DH" });
    fireEvent.change(productSelect, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(
      await screen.findByText(
        "This product is already on this transfer. Edit the existing line instead of adding a new one.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This product is already on this transfer line."),
    ).not.toBeInTheDocument();
  });
});

describe("editing a line", () => {
  it("sends the updated values and refetches on success", async () => {
    // A STATEFUL mock, not a static handler — invalidation only proves
    // anything if the refetch it triggers can observe a real state
    // change, the same discipline Return's own spec already establishes.
    let body: unknown;
    let lines = [lineRow()];
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      managerStockHandler(),
      http.patch(`${API}/admin/agent-transfers/1/lines/1`, async ({ request }) => {
        body = await request.json();
        lines = [lineRow({ quantity: 8, unit_cost: "12.00" })];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Unit cost"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(body).toEqual({ quantity: 8, unit_cost: "12.00", notes: null }),
    );
    await waitFor(() =>
      expect(within(screen.getByRole("table")).getByText("8")).toBeInTheDocument(),
    );
  });
});

describe("removing a line", () => {
  it("calls the delete endpoint and refetches", async () => {
    let called = false;
    let lines = [lineRow()];
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      managerStockHandler(),
      http.delete(`${API}/admin/agent-transfers/1/lines/1`, () => {
        called = true;
        lines = [];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(called).toBe(true));
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).queryByText("IAM 10 DH"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows domain-owned copy on a stock-insufficient refusal", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.delete(`${API}/admin/agent-transfers/1/lines/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "TRANSFER_STOCK_INSUFFICIENT",
            message: "raw backend text",
            context: { product_id: 1, manager_id: 20, requested: 5, available: 2 },
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText(
        "The manager does not hold enough stock of this product to transfer the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw backend text")).not.toBeInTheDocument();
  });
});

describe("Validate — freshness rule (M4 · G4 closure) and error codes", () => {
  it("keeps confirm disabled while the freshness check is in flight", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, async () => {
        call += 1;
        if (call > 1) await delay(200);
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(within(dialog).getByText("Checking for changes…")).toBeInTheDocument();
  });

  it("blocks confirm when the fresh read shows the transfer already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
      ]),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This transfer has already been processed."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("blocks confirm and offers Retry when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(
        1,
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
      ),
      managerStockHandler(),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This transfer's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Validated on success", async () => {
    let status: "draft" | "validated" = "draft";
    server.use(
      http.get(`${API}/admin/agent-transfers/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] })),
      ),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/validate`, () => {
        status = "validated";
        return HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] }));
      }),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Validated")).not.toHaveLength(0);
  });

  it("shows the registered copy for a stock-insufficient 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "TRANSFER_STOCK_INSUFFICIENT",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The manager does not hold enough stock of this product to transfer the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  // TRANSFER-ONLY GATE #1 — no Return equivalent. A real, live capacity
  // check (`StockService::validateTransfer`'s own formula), verified this
  // phase from source.
  it("shows the registered copy for a capacity-exceeded 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "AGENT_TRANSFER_EXCEEDS_CAPACITY",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "This transfer's amount exceeds the commercial's remaining grattage capacity.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  // TRANSFER-ONLY GATE #2 — this IS the Grattage restock gate (Phase 5.10
  // §2.9). This test's own default gate read (from `beforeEach`) is
  // CLEAR, so Validate stays enabled and this exercises the REACTIVE 409
  // fallback specifically — the PROACTIVE path (M6 Phase 3, banner +
  // disabled Validate) has its own dedicated tests below ("the Grattage
  // restock gate").
  it("shows the registered copy for an outstanding-obligation 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The selected commercial has an outstanding grattage obligation and cannot receive new stock yet.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  it("invalidates only the agent-transfers cache on success", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["agent-transfers", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.post(`${API}/admin/agent-transfers/1/validate`, () =>
        HttpResponse.json(
          showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
        ),
      ),
    );
    renderPage("/stock/agent-transfers/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["agent-transfers", "list", {}])?.isInvalidated,
      ).toBe(true),
    );
  });
});

describe("the Grattage restock gate (M6 Phase 3, proactive)", () => {
  it("shows no warning and enables Validate when the gate is clear", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      grattageOutstandingHandler(10, { blocked: false, reason: null }),
    );
    renderPage("/stock/agent-transfers/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
    expect(
      screen.queryByText(/outstanding grattage obligation/i),
    ).not.toBeInTheDocument();
  });

  it("shows the registered recipient-obligation copy and disables Validate when the gate is blocked", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      grattageOutstandingHandler(10, { blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
    );
    renderPage("/stock/agent-transfers/1");

    expect(
      await screen.findByText(
        "The selected commercial has an outstanding grattage obligation and cannot receive new stock yet.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("queries the recipient COMMERCIAL's own commercialId, never the manager", async () => {
    let requestedAgentId: string | undefined;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      http.get(`${API}/admin/agents/:agentId/grattage-outstanding`, ({ params }) => {
        requestedAgentId = params.agentId as string;
        return HttpResponse.json(
          grattageOutstandingEnvelope(10, { blocked: false, reason: null }),
        );
      }),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("button", { name: "Validate" });
    // showEnvelope's own default is `commercial_id: 10` — the recipient
    // commercial — never `manager_id: 20`.
    expect(requestedAgentId).toBe("10");
  });

  it("keeps Validate disabled even after Confirm is opened, blocking the mutation itself", async () => {
    let validateCalled = false;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      managerStockHandler(),
      grattageOutstandingHandler(10, { blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
      http.post(`${API}/admin/agent-transfers/1/validate`, () => {
        validateCalled = true;
        return HttpResponse.json(showEnvelope({ id: 1, status: "validated" }));
      }),
    );
    renderPage("/stock/agent-transfers/1");

    // The button renders enabled first (the gate read is still in flight);
    // wait for the warning to land, which is gated on the same
    // `restockGateBlocked` value, before asserting the button's own state.
    await screen.findByText(/outstanding grattage obligation/i);
    const validateButton = screen.getByRole("button", { name: "Validate" });
    await waitFor(() => expect(validateButton).toBeDisabled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(validateCalled).toBe(false);
  });

  it("hides the warning once the transfer is no longer a draft, even if the gate is still blocked", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      managerStockHandler(),
      grattageOutstandingHandler(10, { blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
    );
    renderPage("/stock/agent-transfers/1");

    await screen.findByRole("heading", { name: /TRF-001/ });
    expect(
      screen.queryByText(/outstanding grattage obligation/i),
    ).not.toBeInTheDocument();
  });
});
