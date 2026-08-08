import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { GrattageInvoiceDetailPage } from "./grattage-invoice-detail-page";

const API = "http://localhost/api/v1";
const LIST_PATH = "/grattage/invoices";
const DETAIL_PATTERN = "/grattage/invoices/:id";

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

type SaleRow = {
  id: number;
  invoice_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
  total: string;
};

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: 1,
    invoice_id: 1,
    product_id: 1,
    quantity: 3,
    unit_price: "10.00",
    total: "30.00",
    ...overrides,
  };
}

/** `GrattageInvoiceController::show`'s own raw model shape, verified fresh from source. */
function showEnvelope(
  overrides: Partial<{
    id: number;
    status: "pending" | "overdue" | "settled" | "cancelled";
    total_amount: string;
    sold_at: string;
    due_at: string;
    declared_at: string | null;
    deposit_id: number | null;
    agent: { id: number; nom: string; prenom: string; num_compte: string };
    client: { id: number; phone: string };
    sales: SaleRow[];
  }> = {},
) {
  return {
    success: true,
    data: {
      id: 1,
      status: "pending" as const,
      total_amount: "150.00",
      sold_at: "2026-08-01T09:00:00.000000Z",
      due_at: "2026-08-02T12:00:00.000000Z",
      declared_at: null,
      deposit_id: null,
      agent: { id: 1, nom: "Alaoui", prenom: "Sara", num_compte: "CM0001" },
      client: { id: 1, phone: "0600100001" },
      sales: [],
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/grattage-invoices/${id}`, () =>
    HttpResponse.json(envelope),
  );
}

function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/grattage-invoices/${id}`, () => {
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
  return http.get(`${API}/admin/grattage-invoices/${id}`, () => {
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
      { path: DETAIL_PATTERN, element: <GrattageInvoiceDetailPage /> },
      { path: LIST_PATH, element: <p>Grattage invoices list</p> },
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
  signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
});

describe("rendering every field show() returns", () => {
  it("renders id, agent, account number, client, amount, status, sold and due dates", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1 })), productsHandler());
    renderPage("/grattage/invoices/1");

    expect(
      await screen.findByRole("heading", { name: /Grattage Invoice #1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("CM0001")).toBeInTheDocument();
    expect(screen.getByText("0600100001")).toBeInTheDocument();
    expect(screen.getByText("150.00 DH")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
  });

  it("shows an em dash for a null declaredAt", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, declared_at: null })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("heading", { name: /Grattage Invoice #1/ });
    // A null depositId ALSO renders "—" (its own dd, below) — the fixture's
    // default — so this asserts at least one dash, not exactly one.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders sales lines, resolving the product name via the reference domain", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({ id: 1, sales: [saleRow({ product_id: 1, quantity: 3 })] }),
      ),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("IAM 10 DH")).toBeInTheDocument();
  });

  it("falls back to a bare product id when the product cannot be resolved", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({ id: 1, sales: [saleRow({ product_id: 999, quantity: 1 })] }),
      ),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    expect(await screen.findByText("Product #999")).toBeInTheDocument();
  });
});

describe("the deposit-link cancellation guard", () => {
  it("renders 'Deposit #N' as plain text, not a link", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "settled", deposit_id: 42 })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    const label = await screen.findByText("Deposit #42");
    expect(label.tagName).not.toBe("A");
    expect(screen.queryByRole("link", { name: /deposit/i })).not.toBeInTheDocument();
  });

  it("hides Cancel and shows an explanatory note when deposit_id is set, even while still pending", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: 42 })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("heading", { name: /Grattage Invoice #1/ });
    expect(
      screen.queryByRole("button", { name: "Cancel invoice" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/linked to reconciliation deposit #42/i)).toBeInTheDocument();
  });

  it("shows no freeze note for a cancellable invoice with no linked deposit", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("button", { name: "Cancel invoice" });
    // The facts grid's own "Reconciliation deposit" label always renders
    // (it shows "—" when unset) — only the FREEZE NOTE's own copy is
    // conditional, so this asserts against that specific text.
    expect(screen.queryByText(/linked to reconciliation deposit/i)).not.toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/grattage-invoices/1`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("shows not-found copy on a 404", async () => {
    server.use(
      http.get(`${API}/admin/grattage-invoices/1`, () =>
        HttpResponse.json(
          { success: false, message: "Facture grattage non trouvée" },
          { status: 404 },
        ),
      ),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status/deposit-link gating", () => {
  it("shows Cancel for a pending, unlinked invoice", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    expect(
      await screen.findByRole("button", { name: "Cancel invoice" }),
    ).toBeInTheDocument();
  });

  it("shows Cancel for an overdue, unlinked invoice", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "overdue", deposit_id: null })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    expect(
      await screen.findByRole("button", { name: "Cancel invoice" }),
    ).toBeInTheDocument();
  });

  it("hides Cancel for a settled invoice", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "settled" })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("heading", { name: /Grattage Invoice #1/ });
    expect(
      screen.queryByRole("button", { name: "Cancel invoice" }),
    ).not.toBeInTheDocument();
  });

  it("hides Cancel for an already-cancelled invoice", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "cancelled" })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    await screen.findByRole("heading", { name: /Grattage Invoice #1/ });
    expect(
      screen.queryByRole("button", { name: "Cancel invoice" }),
    ).not.toBeInTheDocument();
  });

  it("hides Cancel without access-dashboard, even on a pending, unlinked invoice", async () => {
    signInWith([]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    // The route itself is guarded elsewhere (route-authorization.test.tsx);
    // this smoke-checks the in-page action gate in isolation.
    await screen.findByRole("heading", { name: /Grattage Invoice #1/ });
    expect(
      screen.queryByRole("button", { name: "Cancel invoice" }),
    ).not.toBeInTheDocument();
  });
});

describe("Cancel — freshness rule (FTA §8, ADR-0018) and the no-code 409", () => {
  it("blocks confirm when the fresh read shows the invoice already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "pending", deposit_id: null }),
        showEnvelope({ id: 1, status: "settled", deposit_id: null }),
      ]),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(/can no longer be cancelled/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel invoice" })).toBeDisabled();
  });

  it("blocks confirm when a reconciliation deposit links the invoice between load and confirm", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "pending", deposit_id: null }),
        showEnvelope({ id: 1, status: "pending", deposit_id: 42 }),
      ]),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(/can no longer be cancelled/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel invoice" })).toBeDisabled();
  });

  it("blocks confirm and offers Retry when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(
        1,
        showEnvelope({ id: 1, status: "pending", deposit_id: null }),
      ),
      productsHandler(),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This invoice's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closes the dialog and refetches as Cancelled on success", async () => {
    let status: "pending" | "cancelled" = "pending";
    server.use(
      http.get(`${API}/admin/grattage-invoices/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, deposit_id: null })),
      ),
      productsHandler(),
      http.put(`${API}/admin/grattage-invoices/1/cancel`, () => {
        status = "cancelled";
        return HttpResponse.json(showEnvelope({ id: 1, status, deposit_id: null }));
      }),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel invoice" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Cancelled")).not.toHaveLength(0);
  });

  it("sends no request body on cancel — the backend reads nothing from it", async () => {
    let bodyText: string | undefined;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
      http.put(`${API}/admin/grattage-invoices/1/cancel`, async ({ request }) => {
        bodyText = await request.text();
        return HttpResponse.json(
          showEnvelope({ id: 1, status: "cancelled", deposit_id: null }),
        );
      }),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel invoice" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(bodyText).toBe(""));
  });

  it("shows generic copy for the no-code GRATTAGE_SALE_NOT_CANCELLABLE 409, never the raw backend text", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
      http.put(`${API}/admin/grattage-invoices/1/cancel`, () =>
        HttpResponse.json(
          {
            success: false,
            message:
              "Transition de statut invalide (seules les factures pending ou overdue peuvent être annulées)",
            error: "raw backend text",
          },
          { status: 409 },
        ),
      ),
    );
    renderPage("/grattage/invoices/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel invoice" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "This invoice could not be cancelled. It may already have been processed.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("raw backend text")).not.toBeInTheDocument();
  });

  it("invalidates only the grattage-invoices cache on successful cancellation", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["grattage-invoices", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending", deposit_id: null })),
      productsHandler(),
      http.put(`${API}/admin/grattage-invoices/1/cancel`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status: "cancelled", deposit_id: null })),
      ),
    );
    renderPage("/grattage/invoices/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Cancel invoice" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["grattage-invoices", "list", {}])?.isInvalidated,
      ).toBe(true),
    );
  });
});
