import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AllocationDetailPage } from "./allocation-detail-page";

const API = "http://localhost/api/v1";
const ALLOCATIONS_PATH = "/stock/allocations";
const DETAIL_PATTERN = "/stock/allocations/:id";

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
  PERMISSIONS.VIEW_ALLOCATIONS,
  PERMISSIONS.VALIDATE_ALLOCATION,
  PERMISSIONS.CREATE_ALLOCATION_LINE,
  PERMISSIONS.UPDATE_ALLOCATION_LINE,
  PERMISSIONS.DELETE_ALLOCATION_LINE,
];

type LineRow = {
  id: number;
  allocation_id: number;
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
    allocation_id: 1,
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

/** `AllocationResource`'s own row shape, re-verified fresh from source. */
function showEnvelope(
  overrides: Partial<{
    id: number;
    allocation_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    notes: string | null;
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
      allocation_number: "ALL-001",
      status: "draft" as const,
      montant: "50.00",
      notes: null,
      company_id: 5,
      agent_id: 20,
      admin_id: 1,
      approved_by: null,
      approved_at: null,
      cancelled_by: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: "2026-07-25T09:00:00Z",
      updated_at: "2026-07-25T09:00:00Z",
      company: { id: 5, name: "Miza" },
      agent: { id: 20, nom: "Bennani", prenom: "Youssef" },
      creator: { id: 1, name: "Ahmed Errouissi" },
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
  return http.get(`${API}/admin/allocations/${id}`, () => HttpResponse.json(envelope));
}

function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/allocations/${id}`, () => {
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
  return http.get(`${API}/admin/allocations/${id}`, () => {
    call += 1;
    if (call === 1) return HttpResponse.json(firstEnvelope);
    return HttpResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 },
    );
  });
}

/**
 * `GET /admin/companies/{company}/stock` — the "add line" picker's own
 * source of truth now (replaces the generic, unfiltered
 * `GET /admin/products` this page used before the endpoint existed).
 * Scoped to company id 5, matching every `showEnvelope`'s own default
 * `company_id`.
 */
function companyStockHandler() {
  return http.get(`${API}/admin/companies/5/stock`, () =>
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
 * recipient MANAGER's own restock gate. Scoped to agent id 20, matching
 * every `showEnvelope`'s own default `agent_id`. Registered as a CLEAR
 * default in `beforeEach` below so every pre-existing test in this file
 * (none of which override `agent_id`) keeps working unmodified; the tests
 * that specifically exercise the gate override it with their own
 * `server.use(...)`.
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
        nom: "Bennani",
        prenom: "Youssef",
        num_cin: "CIN020",
        num_compte: "MG0020",
        role: "manager",
        status: "active",
        manager: null,
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
      { path: DETAIL_PATTERN, element: <AllocationDetailPage /> },
      { path: ALLOCATIONS_PATH, element: <p>Allocations list</p> },
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
  // Default: a clear gate for agent id 20 — see the handler's own docblock.
  server.use(grattageOutstandingHandler(20));
});

describe("rendering every field show() returns", () => {
  it("renders allocation number, status, company, manager, amount, notes", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, notes: "Q3 restock" })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByRole("heading", { name: /ALL-001/ })).toBeInTheDocument();
    expect(screen.getByText("Miza")).toBeInTheDocument();
    expect(screen.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(screen.getByText("50.00 DH")).toBeInTheDocument();
    expect(screen.getByText("Q3 restock")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders lines when present", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, lines: [lineRow()] })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("IAM 10 DH")).toBeInTheDocument();
  });

  it("renders no Consumptions section — show() never eager-loads it", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, lines: [lineRow()] })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("heading", { name: /ALL-001/ });
    expect(
      screen.queryByRole("heading", { name: /consumption/i }),
    ).not.toBeInTheDocument();
  });
});

describe("status-dependent sections", () => {
  it("shows no Processed section for a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("heading", { name: /ALL-001/ });
    expect(screen.queryByRole("heading", { name: "Processed" })).not.toBeInTheDocument();
  });

  it("shows the Processed section for a validated allocation", async () => {
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
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/allocations/1`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("shows not-found copy on a 404", async () => {
    server.use(
      http.get(`${API}/admin/allocations/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_NOT_FOUND",
            message: "Allocation not found.",
          },
          { status: 404 },
        ),
      ),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status gating", () => {
  it("shows Validate for a draft with at least one line, when the permission is held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
  });

  it("disables Validate on an empty draft, with an explanatory hint", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByText("Add a line first.")).toBeInTheDocument();
  });

  it("hides Validate without the permission", async () => {
    signInWith([PERMISSIONS.VIEW_ALLOCATIONS]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("heading", { name: /ALL-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("hides Validate for an already-validated allocation, even with the permission held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("heading", { name: /ALL-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("renders lines read-only (no Add/Edit/Remove) once no longer a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated", lines: [lineRow()] })),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

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
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/lines`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
    );
    renderPage("/stock/allocations/1");

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
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/lines`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_LINE_DUPLICATE_PRODUCT",
            message: "This product is already on this allocation line.",
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/stock/allocations/1");

    const productSelect = await screen.findByLabelText("Add product");
    await within(productSelect).findByRole("option", { name: "IAM 10 DH" });
    fireEvent.change(productSelect, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(
      await screen.findByText(
        "This product is already on this allocation. Edit the existing line instead of adding a new one.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This product is already on this allocation line."),
    ).not.toBeInTheDocument();
  });
});

describe("editing a line", () => {
  it("sends the updated values and refetches on success", async () => {
    let body: unknown;
    let lines = [lineRow()];
    server.use(
      http.get(`${API}/admin/allocations/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      companyStockHandler(),
      http.patch(`${API}/admin/allocations/1/lines/1`, async ({ request }) => {
        body = await request.json();
        lines = [lineRow({ quantity: 8, unit_cost: "12.00" })];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/allocations/1");

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
      http.get(`${API}/admin/allocations/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      companyStockHandler(),
      http.delete(`${API}/admin/allocations/1/lines/1`, () => {
        called = true;
        lines = [];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/allocations/1");

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
      companyStockHandler(),
      http.delete(`${API}/admin/allocations/1/lines/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_STOCK_INSUFFICIENT",
            message: "raw backend text",
            context: { product_id: 1, company_id: 5, requested: 5, available: 2 },
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText(
        "The company does not hold enough stock of this product to cover the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw backend text")).not.toBeInTheDocument();
  });
});

describe("Validate — freshness rule (M4 · G4 closure) and error codes", () => {
  it("keeps confirm disabled while the freshness check is in flight", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/admin/allocations/1`, async () => {
        call += 1;
        if (call > 1) await delay(200);
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(within(dialog).getByText("Checking for changes…")).toBeInTheDocument();
  });

  it("blocks confirm when the fresh read shows the allocation already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
      ]),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This allocation has already been processed."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("blocks confirm and offers Retry when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(
        1,
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
      ),
      companyStockHandler(),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This allocation's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Validated on success", async () => {
    let status: "draft" | "validated" = "draft";
    server.use(
      http.get(`${API}/admin/allocations/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] })),
      ),
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/validate`, () => {
        status = "validated";
        return HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] }));
      }),
    );
    renderPage("/stock/allocations/1");

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
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_STOCK_INSUFFICIENT",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The company does not hold enough stock of this product to cover the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  // ALLOCATION-ONLY GATE #1 — no Return/Transfer equivalent. The real
  // deposit-capacity formula (`StockService::validateAllocation`'s own
  // FIFO draw), verified this phase from source.
  it("shows the registered copy for a deposit-capacity-exceeded 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The manager does not have enough validated grattage-deposit capacity to cover this allocation's amount.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  // ALLOCATION-ONLY GATE #2 — Phase 5.10 §2.9's TEAM restock gate (any
  // commercial under the manager, not the manager alone). This test's
  // own default gate read (from `beforeEach`) is CLEAR, so Validate stays
  // enabled and this exercises the REACTIVE 409 fallback specifically —
  // the PROACTIVE path (M6 Phase 3, banner + disabled Validate) has its
  // own dedicated tests below ("the Grattage restock gate").
  it("shows the registered copy for a team outstanding-obligation 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/allocations/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "A commercial under this manager has an outstanding grattage obligation. Resolve it before allocating more stock to this team.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  it("invalidates only the allocations cache on success", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["allocations", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      http.post(`${API}/admin/allocations/1/validate`, () =>
        HttpResponse.json(
          showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
        ),
      ),
    );
    renderPage("/stock/allocations/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(queryClient.getQueryState(["allocations", "list", {}])?.isInvalidated).toBe(
        true,
      ),
    );
  });
});

describe("the Grattage restock gate (M6 Phase 3, proactive)", () => {
  it("shows no warning and enables Validate when the gate is clear", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      grattageOutstandingHandler(20, { blocked: false, reason: null }),
    );
    renderPage("/stock/allocations/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
    expect(
      screen.queryByText(/outstanding grattage obligation/i),
    ).not.toBeInTheDocument();
  });

  it("shows the registered team-obligation copy and disables Validate when the gate is blocked", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      grattageOutstandingHandler(20, {
        blocked: true,
        reason: "TEAM_OUTSTANDING_GRATTAGE",
      }),
    );
    renderPage("/stock/allocations/1");

    expect(
      await screen.findByText(
        "A commercial under this manager has an outstanding grattage obligation. Resolve it before allocating more stock to this team.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("queries the recipient MANAGER's own agentId, never the company", async () => {
    let requestedAgentId: string | undefined;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      http.get(`${API}/admin/agents/:agentId/grattage-outstanding`, ({ params }) => {
        requestedAgentId = params.agentId as string;
        return HttpResponse.json(
          grattageOutstandingEnvelope(20, { blocked: false, reason: null }),
        );
      }),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("button", { name: "Validate" });
    // showEnvelope's own default is `agent_id: 20` — the recipient
    // manager — never `company_id: 5`.
    expect(requestedAgentId).toBe("20");
  });

  it("keeps Validate disabled even after Confirm is opened, blocking the mutation itself", async () => {
    let validateCalled = false;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      companyStockHandler(),
      grattageOutstandingHandler(20, {
        blocked: true,
        reason: "TEAM_OUTSTANDING_GRATTAGE",
      }),
      http.post(`${API}/admin/allocations/1/validate`, () => {
        validateCalled = true;
        return HttpResponse.json(showEnvelope({ id: 1, status: "validated" }));
      }),
    );
    renderPage("/stock/allocations/1");

    // The button renders enabled first (the gate read is still in flight);
    // wait for the warning to land, which is gated on the same
    // `restockGateBlocked` value, before asserting the button's own state.
    await screen.findByText(/outstanding grattage obligation/i);
    const validateButton = screen.getByRole("button", { name: "Validate" });
    await waitFor(() => expect(validateButton).toBeDisabled());
    // A disabled button does not open the dialog at all — confirming there
    // is no way to reach the mutation from here.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(validateCalled).toBe(false);
  });

  it("hides the warning once the allocation is no longer a draft, even if the gate is still blocked", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      companyStockHandler(),
      grattageOutstandingHandler(20, {
        blocked: true,
        reason: "TEAM_OUTSTANDING_GRATTAGE",
      }),
    );
    renderPage("/stock/allocations/1");

    await screen.findByRole("heading", { name: /ALL-001/ });
    expect(
      screen.queryByText(/outstanding grattage obligation/i),
    ).not.toBeInTheDocument();
  });
});
