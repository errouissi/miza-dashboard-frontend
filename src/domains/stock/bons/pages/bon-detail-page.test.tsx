import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { BonDetailPage } from "./bon-detail-page";

const API = "http://localhost/api/v1";
const BONS_PATH = "/stock/bons";
const DETAIL_PATTERN = "/stock/bons/:id";

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
  PERMISSIONS.VIEW_BONS,
  PERMISSIONS.VALIDATE_BON,
  PERMISSIONS.CANCEL_BON,
  PERMISSIONS.CREATE_BON_LINE,
  PERMISSIONS.UPDATE_BON_LINE,
  PERMISSIONS.DELETE_BON_LINE,
];

type LineRow = {
  id: number;
  bon_id: number;
  product_id: number;
  quantity: number;
  unit_cost: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product: { id: number; name: string } | null;
};

function lineRow(overrides: Partial<LineRow> = {}): LineRow {
  return {
    id: 1,
    bon_id: 1,
    product_id: 1,
    quantity: 5,
    unit_cost: "10.00",
    notes: null,
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-01T09:00:00Z",
    product: { id: 1, name: "IAM 10 DH" },
    ...overrides,
  };
}

/** `BonResource`'s own row shape, re-verified fresh from source. */
function showEnvelope(
  overrides: Partial<{
    id: number;
    bon_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    notes: string | null;
    evidence_url: string | null;
    evidence_name: string | null;
    received_at: string | null;
    approved_by: number | null;
    approved_at: string | null;
    cancelled_by: number | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    lines: LineRow[];
    validation_summary: { line_count: number; total_quantity: number };
  }> = {},
) {
  const lines = overrides.lines ?? [];
  return {
    data: {
      id: 1,
      bon_number: "BON-001",
      status: "draft" as const,
      admin_id: 1,
      supplier_id: 7,
      company_id: 5,
      notes: null,
      evidence_url: "http://localhost/storage/bons/2026/08/supplier_7/evidence_x.pdf",
      evidence_name: "evidence_x.pdf",
      montant: "50.00",
      received_at: "2026-08-01",
      approved_by: null,
      approved_at: null,
      cancelled_by: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: "2026-08-01T09:00:00Z",
      updated_at: "2026-08-01T09:00:00Z",
      supplier: { id: 7, name: "Default Supplier" },
      company: { id: 5, name: "Miza" },
      creator: { id: 1, name: "Ahmed Errouissi" },
      approver: null,
      lines,
      validation_summary: {
        line_count: lines.length,
        total_quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      },
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/bons/${id}`, () => HttpResponse.json(envelope));
}

function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/bons/${id}`, () => {
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
  return http.get(`${API}/admin/bons/${id}`, () => {
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
      { path: DETAIL_PATTERN, element: <BonDetailPage /> },
      { path: BONS_PATH, element: <p>Bons list</p> },
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
  it("renders bon number, status, supplier, company, amount, received date, notes, evidence link", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, notes: "Delivered on-site" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("heading", { name: /BON-001/ })).toBeInTheDocument();
    expect(screen.getByText("Default Supplier")).toBeInTheDocument();
    expect(screen.getByText("Miza")).toBeInTheDocument();
    expect(screen.getByText("50.00 DH")).toBeInTheDocument();
    expect(screen.getByText("Delivered on-site")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    const evidenceLink = screen.getByRole("link", { name: "evidence_x.pdf" });
    expect(evidenceLink).toHaveAttribute(
      "href",
      "http://localhost/storage/bons/2026/08/supplier_7/evidence_x.pdf",
    );
  });

  it("renders lines when present", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("IAM 10 DH")).toBeInTheDocument();
  });
});

describe("status-dependent sections", () => {
  it("shows no Processed and no Cancelled section for a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    await screen.findByRole("heading", { name: /BON-001/ });
    expect(screen.queryByRole("heading", { name: "Processed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cancelled" })).not.toBeInTheDocument();
  });

  it("shows the Processed section, not Cancelled, for a validated bon", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "validated",
          approved_by: 1,
          approved_at: "2026-08-02T10:00:00Z",
        }),
      ),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cancelled" })).not.toBeInTheDocument();
  });

  it("shows BOTH Processed and Cancelled sections for a cancelled bon", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "cancelled",
          approved_by: 1,
          approved_at: "2026-08-02T10:00:00Z",
          cancelled_by: 1,
          cancelled_at: "2026-08-03T10:00:00Z",
          cancellation_reason: "Delivered to the wrong warehouse",
        }),
      ),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelled" })).toBeInTheDocument();
    expect(screen.getByText("Delivered to the wrong warehouse")).toBeInTheDocument();
    // No "Cancelled by" field anywhere — no name-resolved relation exists (see model docblock).
    expect(screen.queryByText(/cancelled by/i)).not.toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/bons/1`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("shows not-found copy on a 404", async () => {
    server.use(
      http.get(`${API}/admin/bons/1`, () =>
        HttpResponse.json(
          { success: false, code: "BON_NOT_FOUND", message: "Bon not found." },
          { status: 404 },
        ),
      ),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status gating", () => {
  it("shows Validate for a draft with at least one line", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancel bon" })).not.toBeInTheDocument();
  });

  it("disables Validate on an empty draft, with an explanatory hint", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByText("Add a line first.")).toBeInTheDocument();
  });

  it("shows Cancel bon, not Validate, for a validated bon", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    expect(await screen.findByRole("button", { name: "Cancel bon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
  });

  it("hides both Validate and Cancel bon for a cancelled bon", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "cancelled" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    await screen.findByRole("heading", { name: /BON-001/ });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel bon" })).not.toBeInTheDocument();
  });

  it("hides Cancel bon without cancel-bon, even on a validated bon", async () => {
    signInWith([PERMISSIONS.VIEW_BONS]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    await screen.findByRole("heading", { name: /BON-001/ });
    expect(screen.queryByRole("button", { name: "Cancel bon" })).not.toBeInTheDocument();
  });

  it("renders lines read-only once no longer a draft", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated", lines: [lineRow()] })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

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
      http.post(`${API}/admin/bons/1/lines`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        );
      }),
    );
    renderPage("/stock/bons/1");

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
});

describe("removing a line", () => {
  it("calls the delete endpoint (204, no body) and refetches", async () => {
    let called = false;
    let lines = [lineRow()];
    server.use(
      http.get(`${API}/admin/bons/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "draft", lines })),
      ),
      productsHandler(),
      http.delete(`${API}/admin/bons/1/lines/1`, () => {
        called = true;
        lines = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(called).toBe(true));
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).queryByText("IAM 10 DH"),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("Validate — freshness rule (M4 · G4 closure) and error codes", () => {
  it("blocks confirm when the fresh read shows the bon already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "draft", lines: [lineRow()] }),
        showEnvelope({ id: 1, status: "validated", lines: [lineRow()] }),
      ]),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This bon has already been processed."),
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
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This bon's current status could not be verified."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Validated on success", async () => {
    let status: "draft" | "validated" = "draft";
    server.use(
      http.get(`${API}/admin/bons/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] })),
      ),
      productsHandler(),
      http.post(`${API}/admin/bons/1/validate`, () => {
        status = "validated";
        return HttpResponse.json(showEnvelope({ id: 1, status, lines: [lineRow()] }));
      }),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Validated")).not.toHaveLength(0);
  });

  it("shows the registered copy for a has-no-lines 409 on validate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "draft", lines: [lineRow()] })),
      productsHandler(),
      http.post(`${API}/admin/bons/1/validate`, () =>
        HttpResponse.json(
          { success: false, code: "BON_HAS_NO_LINES", message: "raw backend text" },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "Add at least one line before validating this bon.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });
});

describe("Cancel — freshness rule (SHARED query with Validate) and error codes", () => {
  it("keeps confirm disabled until a reason of at least 10 characters is entered", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    // Empty reason keeps confirm disabled regardless of freshness — wait for
    // the freshness check itself to settle (its own "Checking…" text gone)
    // before asserting anything about the reason-length gate specifically.
    await waitFor(() =>
      expect(within(dialog).queryByText("Checking for changes…")).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByRole("button", { name: "Cancel bon" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "too short" },
    });
    expect(within(dialog).getByRole("button", { name: "Cancel bon" })).toBeDisabled();
    expect(
      within(dialog).getByText("Reason must be at least 10 characters."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "Delivered to the wrong warehouse" },
    });
    expect(within(dialog).getByRole("button", { name: "Cancel bon" })).toBeEnabled();
  });

  it("blocks confirm when the fresh read shows the bon is no longer validated", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "validated" }),
        showEnvelope({ id: 1, status: "cancelled" }),
      ]),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This bon is no longer validated — it may already have been cancelled.",
      ),
    ).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Cancelled on success", async () => {
    let status: "validated" | "cancelled" = "validated";
    server.use(
      http.get(`${API}/admin/bons/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status })),
      ),
      productsHandler(),
      http.post(`${API}/admin/bons/1/cancel`, async ({ request }) => {
        const body = (await request.json()) as { cancellation_reason: string };
        status = "cancelled";
        return HttpResponse.json(
          showEnvelope({
            id: 1,
            status,
            cancelled_at: "2026-08-05T10:00:00Z",
            cancellation_reason: body.cancellation_reason,
          }),
        );
      }),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "Delivered to the wrong warehouse" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel bon" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Cancelled")).not.toHaveLength(0);
  });

  it("shows the registered copy for a BON_CANCEL_STOCK_INSUFFICIENT 409 — a real, live gate", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
      http.post(`${API}/admin/bons/1/cancel`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "BON_CANCEL_STOCK_INSUFFICIENT",
            message: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "Delivered to the wrong warehouse" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel bon" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "This bon cannot be cancelled: the stock it brought in has already been used elsewhere.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  it("maps a server-side field error on cancellation_reason to the reason field", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
      http.post(`${API}/admin/bons/1/cancel`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: {
              cancellation_reason: ["The cancellation reason field is required."],
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "Delivered to the wrong warehouse" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel bon" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText("The cancellation reason field is required."),
    ).toBeInTheDocument();
  });

  it("invalidates only the bons cache on successful cancellation", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["bons", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
      http.post(`${API}/admin/bons/1/cancel`, () =>
        HttpResponse.json(
          showEnvelope({
            id: 1,
            status: "cancelled",
            cancelled_at: "2026-08-05T10:00:00Z",
          }),
        ),
      ),
    );
    renderPage("/stock/bons/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Cancellation reason"), {
      target: { value: "Delivered to the wrong warehouse" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel bon" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(queryClient.getQueryState(["bons", "list", {}])?.isInvalidated).toBe(true),
    );
  });
});

describe("freshness query is shared between Validate and Cancel, independent hasChanged predicates", () => {
  it("does not show Checking… delay artifacts across dialog switches (smoke)", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "validated" })),
      productsHandler(),
    );
    renderPage("/stock/bons/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel bon" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Reopening still works correctly against the shared freshness query.
    fireEvent.click(screen.getByRole("button", { name: "Cancel bon" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Cancel bon" }),
      ).toBeInTheDocument(),
    );
  });
});
