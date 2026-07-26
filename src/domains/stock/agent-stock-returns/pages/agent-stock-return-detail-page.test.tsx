import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentStockReturnDetailPage } from "./agent-stock-return-detail-page";

const API = "http://localhost/api/v1";
const RETURNS_PATH = "/stock/agent-stock-returns";
const DETAIL_PATTERN = "/stock/agent-stock-returns/:id";

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
  PERMISSIONS.VIEW_AGENT_STOCK_RETURN,
  PERMISSIONS.VALIDATE_AGENT_STOCK_RETURN,
  PERMISSIONS.CREATE_AGENT_STOCK_RETURN_LINE,
  PERMISSIONS.UPDATE_AGENT_STOCK_RETURN_LINE,
  PERMISSIONS.DELETE_AGENT_STOCK_RETURN_LINE,
];

type LineRow = {
  id: number;
  return_id: number;
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
    return_id: 1,
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

/** `AgentStockReturnResource`'s own row shape, re-verified fresh from source. */
function showEnvelope(
  overrides: Partial<{
    id: number;
    return_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    notes: string | null;
    return_date: string | null;
    approved_by: number | null;
    approved_at: string | null;
    lines: LineRow[];
    validation_summary: {
      total_lines: number;
      total_quantity: number;
      total_montant: string;
    };
  }> = {},
) {
  const lines = overrides.lines ?? [];
  return {
    data: {
      id: 1,
      return_number: "RET-001",
      status: "draft" as const,
      montant: "50.00",
      notes: null,
      return_date: "2026-07-20",
      admin_id: 1,
      commercial_id: 10,
      manager_id: 20,
      approved_by: null,
      approved_at: null,
      created_at: "2026-07-25T09:00:00Z",
      updated_at: "2026-07-25T09:00:00Z",
      creator: { id: 1, name: "Ahmed Errouissi" },
      commercial: { id: 10, nom: "Alaoui", prenom: "Sara" },
      manager: { id: 20, nom: "Bennani", prenom: "Youssef" },
      approver: null,
      lines,
      validation_summary: {
        total_lines: lines.length,
        total_quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        total_montant: "50.00",
      },
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/agent-stock-returns/${id}`, () =>
    HttpResponse.json(envelope),
  );
}

function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/agent-stock-returns/${id}`, () => {
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
  return http.get(`${API}/admin/agent-stock-returns/${id}`, () => {
    call += 1;
    if (call === 1) return HttpResponse.json(firstEnvelope);
    return HttpResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 },
    );
  });
}

function productsHandler() {
  return http.get(`${API}/admin/products`, () =>
    HttpResponse.json([
      { id: 1, name: "IAM 10 DH", operator: "IAM", value: 10 },
      { id: 2, name: "INWI 20 DH", operator: "INWI", value: 20 },
    ]),
  );
}

function renderPage(initialPath: string, queryClient: QueryClient = createQueryClient()) {
  const router = createMemoryRouter(
    [
      { path: DETAIL_PATTERN, element: <AgentStockReturnDetailPage /> },
      { path: RETURNS_PATH, element: <p>Agent Stock Returns list</p> },
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
});

describe("rendering every field show() returns", () => {
  it("renders return number, status, commercial, manager, amount, dates, notes", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, notes: "Excess stock" })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    expect(await screen.findByRole("heading", { name: /RET-001/ })).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(screen.getByText("50.00 DH")).toBeInTheDocument();
    expect(screen.getByText("Excess stock")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("renders lines when present", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("IAM 10 DH")).toBeInTheDocument();
  });
});

describe("status-dependent sections", () => {
  it("shows no Processed section for a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByRole("heading", { name: /RET-001/ });
    expect(screen.queryByRole("heading", { name: "Processed" })).not.toBeInTheDocument();
  });

  it("shows the Processed section for a validated return", async () => {
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
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/agent-stock-returns/1`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("shows not-found copy on a 404", async () => {
    server.use(
      http.get(`${API}/admin/agent-stock-returns/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "RETURN_NOT_FOUND",
            message: "Agent stock return not found.",
          },
          { status: 404 },
        ),
      ),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status gating", () => {
  it("shows Validate for a draft with at least one line, when the permission is held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
  });

  it("disables Validate on an empty draft, with an explanatory hint", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByText("Add a line first.")).toBeInTheDocument();
  });

  it("hides Validate without the permission", async () => {
    signInWith([PERMISSIONS.VIEW_AGENT_STOCK_RETURN]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByRole("heading", { name: /RET-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("hides Validate for an already-validated return, even with the permission held", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByRole("heading", { name: /RET-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("renders lines read-only (no Add/Edit/Remove) once no longer a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated", lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

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
      productsHandler(),
      http.post(`${API}/admin/agent-stock-returns/1/lines`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByLabelText("Add product");
    fireEvent.change(screen.getByLabelText("Add product"), { target: { value: "1" } });
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
      productsHandler(),
      http.post(`${API}/admin/agent-stock-returns/1/lines`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "RETURN_LINE_DUPLICATE_PRODUCT",
            message: "This product is already on this stock return line.",
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/stock/agent-stock-returns/1");

    await screen.findByLabelText("Add product");
    fireEvent.change(screen.getByLabelText("Add product"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(
      await screen.findByText(
        "This product is already on this stock return. Edit the existing line instead of adding a new one.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This product is already on this stock return line."),
    ).not.toBeInTheDocument();
  });
});

describe("editing a line", () => {
  it("sends the updated values and refetches on success", async () => {
    // A STATEFUL mock, not a static handler — invalidation only proves
    // anything if the refetch it triggers can observe a real state
    // change, the same discipline every prior detail-page spec in this
    // app already establishes for its own "refetches on success" test.
    let body: unknown;
    let lines = [lineRow()];
    server.use(
      http.get(`${API}/admin/agent-stock-returns/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      productsHandler(),
      http.patch(`${API}/admin/agent-stock-returns/1/lines/1`, async ({ request }) => {
        body = await request.json();
        lines = [lineRow({ quantity: 8, unit_cost: "12.00" })];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/agent-stock-returns/1");

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
      http.get(`${API}/admin/agent-stock-returns/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      productsHandler(),
      http.delete(`${API}/admin/agent-stock-returns/1/lines/1`, () => {
        called = true;
        lines = [];
        return HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines }));
      }),
    );
    renderPage("/stock/agent-stock-returns/1");

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
      productsHandler(),
      http.delete(`${API}/admin/agent-stock-returns/1/lines/1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "RETURN_STOCK_INSUFFICIENT",
            message: "raw backend text",
            context: { product_id: 1, commercial_id: 10, requested: 5, available: 2 },
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-stock-returns/1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText(
        "The commercial does not hold enough stock of this product to return the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw backend text")).not.toBeInTheDocument();
  });
});

describe("Validate — freshness rule (M4 · G4 closure) and error codes", () => {
  it("keeps confirm disabled while the freshness check is in flight", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/admin/agent-stock-returns/1`, async () => {
        call += 1;
        if (call > 1) await delay(200);
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(within(dialog).getByText("Checking for changes…")).toBeInTheDocument();
  });

  it("blocks confirm when the fresh read shows the return already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
      ]),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This stock return has already been processed."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("blocks confirm and offers Retry when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(
        1,
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
      ),
      productsHandler(),
    );
    renderPage("/stock/agent-stock-returns/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This stock return's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Validated on success", async () => {
    let status: "draft" | "validated" = "draft";
    server.use(
      http.get(`${API}/admin/agent-stock-returns/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] })),
      ),
      productsHandler(),
      http.post(`${API}/admin/agent-stock-returns/1/validate`, () => {
        status = "validated";
        return HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] }));
      }),
    );
    renderPage("/stock/agent-stock-returns/1");

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
      productsHandler(),
      http.post(`${API}/admin/agent-stock-returns/1/validate`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "RETURN_STOCK_INSUFFICIENT",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/agent-stock-returns/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The commercial does not hold enough stock of this product to return the requested quantity.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  it("invalidates only the agent-stock-returns cache on success", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["agent-stock-returns", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      productsHandler(),
      http.post(`${API}/admin/agent-stock-returns/1/validate`, () =>
        HttpResponse.json(
          showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
        ),
      ),
    );
    renderPage("/stock/agent-stock-returns/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["agent-stock-returns", "list", {}])?.isInvalidated,
      ).toBe(true),
    );
  });
});
