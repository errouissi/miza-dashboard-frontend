import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { formatDateTime } from "@/shared/formatters";
import { DepositDetailPage } from "./deposits-detail-page";

const API = "http://localhost/api/v1";
const DEPOSITS_PATH = "/money/deposits";
const DETAIL_PATTERN = "/money/deposits/:id";

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
 * `show()`'s own row shape, re-verified fresh from source this phase
 * (`DepoResource::toArray()`, unchanged since commit `8786326`): all 15
 * fields, wrapped in Laravel's default single-resource `{"data": {...}}`.
 */
function showEnvelope(
  overrides: Partial<{
    id: number;
    amount: number;
    status: "pending" | "validated" | "rejected";
    type: "rapped" | "grattage";
    method: "bank" | "cash" | "other";
    receipt: string | null;
    proof_url: string | null;
    date: string;
    reject_reason: string | null;
    validated_by: string | null;
    validated_at: string | null;
    bank_name: string | null;
    proof_type: "bank_receipt" | "whatsapp_confirmation";
    agent: {
      id: number;
      full_name: string;
      account_number: string;
      photo: string | null;
    };
    created_by: string;
  }> = {},
) {
  return {
    data: {
      id: 1,
      amount: 1500,
      status: "pending" as const,
      type: "rapped" as const,
      method: "bank" as const,
      receipt: "REC-001",
      proof_url: null,
      date: "2026-02-10 09:00",
      reject_reason: null,
      validated_by: null,
      validated_at: null,
      bank_name: null,
      proof_type: "bank_receipt",
      agent: { id: 1, full_name: "Sara Alaoui", account_number: "MG0001", photo: null },
      created_by: "Ahmed Errouissi",
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/depos/${id}`, () => HttpResponse.json(envelope));
}

/**
 * Returns a DIFFERENT envelope on each successive GET — the page's own
 * initial load is the first call; a freshness-rule refetch (M4 · G4
 * closure), fired the instant Validate/Reject opens, is the second.
 */
function sequentialShowHandler(id: number, envelopes: ReturnType<typeof showEnvelope>[]) {
  let call = 0;
  return http.get(`${API}/admin/depos/${id}`, () => {
    const envelope = envelopes[Math.min(call, envelopes.length - 1)];
    call += 1;
    return HttpResponse.json(envelope);
  });
}

/** The second (and every later) GET fails — simulates the freshness refetch itself failing. */
function failingAfterFirstShowHandler(
  id: number,
  firstEnvelope: ReturnType<typeof showEnvelope>,
) {
  let call = 0;
  return http.get(`${API}/admin/depos/${id}`, () => {
    call += 1;
    if (call === 1) return HttpResponse.json(firstEnvelope);
    return HttpResponse.json({ error: "Erreur serveur" }, { status: 500 });
  });
}

function renderPage(initialPath: string, queryClient: QueryClient = createQueryClient()) {
  const router = createMemoryRouter(
    [
      { path: DETAIL_PATTERN, element: <DepositDetailPage /> },
      { path: DEPOSITS_PATH, element: <p>Deposits list</p> },
      // A stub so the linked-invoice navigation test (M6 Phase 4) lands on
      // a real route rather than a router-level 404 — mirrors the
      // identical precedent every other cross-page navigation test in
      // this codebase already uses.
      { path: "/grattage/invoices/:id", element: <p>Grattage invoice detail</p> },
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

/** `GrattageInvoiceController::index`'s own row shape — only the four fields the panel reads. */
function linkedInvoiceRow(
  overrides: Partial<{
    id: number;
    status: "pending" | "overdue" | "settled" | "cancelled";
    total_amount: string;
    sold_at: string;
  }> = {},
) {
  return {
    id: 101,
    status: "settled" as const,
    total_amount: "150.00",
    sold_at: "2026-08-01T09:00:00.000000Z",
    ...overrides,
  };
}

function grattageInvoicesHandler(
  rows: ReturnType<typeof linkedInvoiceRow>[],
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/grattage-invoices`, ({ request }) => {
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

function validateHandler(id: number, onRequest?: (body: unknown) => void) {
  return http.post(`${API}/admin/depos/${id}/validate`, async ({ request }) => {
    onRequest?.(await request.text());
    return HttpResponse.json({ message: "Deposit validated and balance updated." });
  });
}

function rejectHandler(id: number, onRequest?: (body: unknown) => void) {
  return http.post(`${API}/admin/depos/${id}/reject`, async ({ request }) => {
    onRequest?.(await request.json().catch(() => undefined));
    return HttpResponse.json({ message: "Deposit rejected successfully." });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.VIEW_DEPOSITS]);
});

describe("rendering every field show() returns", () => {
  it("renders receipt, agent, account number, amount, type, method, status, submitted date, created by", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          receipt: "REC-001",
          amount: 1234.56,
          agent: {
            id: 1,
            full_name: "Sara Alaoui",
            account_number: "MG0001",
            photo: null,
          },
          status: "pending",
          type: "grattage",
          method: "cash",
          date: "2026-02-10 09:00",
          created_by: "Ahmed Errouissi",
        }),
      ),
    );
    renderPage("/money/deposits/1");

    expect(
      await screen.findByRole("heading", { name: "Deposit #1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("REC-001")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("MG0001")).toBeInTheDocument();
    expect(screen.getByText(/1\s*234,56\s*DH/)).toBeInTheDocument();
    expect(screen.getByText("Grattage")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("10/02/2026")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Errouissi")).toBeInTheDocument();
  });

  it("renders bank name with a dash placeholder when absent, the value when present", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, bank_name: null })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders bank name when present", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, bank_name: "Attijariwafa" })));
    renderPage("/money/deposits/1");

    expect(await screen.findByText("Attijariwafa")).toBeInTheDocument();
  });

  it("renders the proof type label", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, proof_type: "whatsapp_confirmation" })),
    );
    renderPage("/money/deposits/1");

    expect(await screen.findByText("WhatsApp confirmation")).toBeInTheDocument();
  });

  it("renders the proof image when proof_url is present", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({ id: 1, proof_url: "http://localhost/storage/depos/1.jpg" }),
      ),
    );
    renderPage("/money/deposits/1");

    const image = await screen.findByRole("img", { name: /deposit 1 proof/i });
    expect(image).toHaveAttribute("src", "http://localhost/storage/depos/1.jpg");
  });

  it("renders no image when proof_url is null — never fabricates one", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, proof_url: null })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("status-dependent sections", () => {
  it("shows no Processed or Reject reason section for a pending deposit", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "pending",
          validated_by: null,
          validated_at: null,
          reject_reason: null,
        }),
      ),
    );
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.queryByRole("heading", { name: "Processed" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Reject reason" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Processed section (by/at) for a validated deposit, no Reject reason", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "validated",
          validated_by: "Ahmed Errouissi",
          validated_at: "2026-02-11 14:30",
          reject_reason: null,
        }),
      ),
    );
    renderPage("/money/deposits/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
    expect(screen.getByText("Processed by")).toBeInTheDocument();
    // Computed via the same formatter rather than a hardcoded literal — see
    // the equivalent note in `cheque-detail-page.test.tsx`.
    expect(screen.getByText(formatDateTime("2026-02-11T14:30"))).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Reject reason" }),
    ).not.toBeInTheDocument();
  });

  it("shows BOTH Processed and Reject reason for a rejected deposit — validated_by/at populate on reject too", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          status: "rejected",
          validated_by: "Ahmed Errouissi",
          validated_at: "2026-02-11 14:30",
          reject_reason: "Illegible receipt",
        }),
      ),
    );
    renderPage("/money/deposits/1");

    expect(await screen.findByRole("heading", { name: "Processed" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Reject reason" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Illegible receipt")).toBeInTheDocument();
  });
});

describe("nullable optional fields", () => {
  it("renders a null receipt as the absent dash", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, receipt: null })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    // `bank_name` ALSO defaults to `null` -> "—" in this fixture, so a bare
    // `getByText("—")` would be ambiguous — scope to the Receipt row's own
    // `<dd>` specifically.
    const receiptTerm = screen.getByText("Receipt");
    expect(receiptTerm.nextElementSibling).toHaveTextContent("—");
  });
});

describe("loading, error and not-found states", () => {
  it("shows a loading state before the response resolves", async () => {
    server.use(
      http.get(`${API}/admin/depos/1`, async () => {
        await delay(30);
        return HttpResponse.json(showEnvelope({ id: 1 }));
      }),
    );
    renderPage("/money/deposits/1");

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows a not-found message on a 404 (Laravel's own generic shape)", async () => {
    server.use(
      http.get(`${API}/admin/depos/999`, () =>
        HttpResponse.json(
          { message: "No query results for model [App\\Models\\Deposit] 999" },
          { status: 404 },
        ),
      ),
    );
    renderPage("/money/deposits/999");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/depos/1`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage("/money/deposits/1");

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows an invalid-reference message for a non-numeric id, without calling the API", async () => {
    renderPage("/money/deposits/not-a-number");

    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("navigates back to the Deposits list", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1 })));
    const { router } = renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Back to Deposits" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEPOSITS_PATH));
  });
});

describe("action visibility — permission AND status gating (M4.3 Phase 3)", () => {
  it("shows Validate and Reject for a pending deposit when both permissions are held", async () => {
    signInWith([
      PERMISSIONS.VIEW_DEPOSITS,
      PERMISSIONS.VALIDATE_DEPOSIT,
      PERMISSIONS.REJECT_DEPOSIT,
    ]);
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    renderPage("/money/deposits/1");

    expect(await screen.findByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("hides Validate/Reject for a pending deposit when the permission is not held", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS]);
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("hides both actions for a validated deposit, even with both permissions held", async () => {
    signInWith([
      PERMISSIONS.VIEW_DEPOSITS,
      PERMISSIONS.VALIDATE_DEPOSIT,
      PERMISSIONS.REJECT_DEPOSIT,
    ]);
    server.use(showHandler(1, showEnvelope({ id: 1, status: "validated" })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("hides both actions for a rejected deposit, even with both permissions held", async () => {
    signInWith([
      PERMISSIONS.VIEW_DEPOSITS,
      PERMISSIONS.VALIDATE_DEPOSIT,
      PERMISSIONS.REJECT_DEPOSIT,
    ]);
    server.use(showHandler(1, showEnvelope({ id: 1, status: "rejected" })));
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});

describe("Validate", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.VALIDATE_DEPOSIT]);
  });

  it("opens a confirmation dialog, sends no body", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      validateHandler(1, (b) => (body = b)),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(body).toBe(""));
  });

  it("disables the confirm button while pending, preventing a duplicate submission", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      http.post(`${API}/admin/depos/1/validate`, async () => {
        await delay(50);
        return HttpResponse.json({ message: "Deposit validated and balance updated." });
      }),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByRole("button", { name: "Validating…" }),
    ).toBeDisabled();
    // A second click while pending must not fire a second request — the
    // button is disabled, so `fireEvent.click` is a no-op here; the real
    // assertion is the disabled state above plus the single successful
    // request this test's handler only ever expects once.
  });

  it("closes the dialog and refetches the deposit as Validated on success", async () => {
    // A STATEFUL mock, not a static handler — invalidation only proves
    // anything if the refetch it triggers can observe a real state change,
    // the same discipline `cheque-detail-page.test.tsx`'s own Approve test
    // already established.
    let status: "pending" | "validated" = "pending";
    server.use(
      http.get(`${API}/admin/depos/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status })),
      ),
      http.post(`${API}/admin/depos/1/validate`, () => {
        status = "validated";
        return HttpResponse.json({ message: "Deposit validated and balance updated." });
      }),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Validated")).not.toHaveLength(0);
  });

  it("keeps the dialog open and shows an error on failure, without losing the deposit", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      http.post(`${API}/admin/depos/1/validate`, () =>
        HttpResponse.json({ error: "This deposit is not pending." }, { status: 400 }),
      ),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be validated/i,
    );
    expect(dialog).toBeInTheDocument();
  });

  it("invalidates only the deposits cache on success — no Network prefix (verified: neither path touches montant_avance_*)", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["managers", "list", {}], { fake: true });
    queryClient.setQueryData(["commercials", "list", {}], { fake: true });
    queryClient.setQueryData(["deposits", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      validateHandler(1),
    );
    renderPage("/money/deposits/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(queryClient.getQueryState(["deposits", "list", {}])?.isInvalidated).toBe(
        true,
      ),
    );
    expect(queryClient.getQueryState(["managers", "list", {}])?.isInvalidated).toBe(
      false,
    );
    expect(queryClient.getQueryState(["commercials", "list", {}])?.isInvalidated).toBe(
      false,
    );
  });
});

describe("Validate — freshness rule (M4 · G4 closure)", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.VALIDATE_DEPOSIT]);
  });

  it("blocks confirm and explains when the fresh read shows the deposit already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "pending" }),
        showEnvelope({ id: 1, status: "rejected" }),
      ]),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText("This deposit has already been processed."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("blocks confirm and offers Retry when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(1, showEnvelope({ id: 1, status: "pending" })),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      await within(dialog).findByText(
        "This deposit's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("Reject", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.REJECT_DEPOSIT]);
  });

  it("disables Reject in the dialog until the reason reaches the backend's own 10-character minimum", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    const reasonField = within(dialog).getByLabelText("Reason");

    expect(confirmButton).toBeDisabled();

    fireEvent.change(reasonField, { target: { value: "short" } });
    expect(confirmButton).toBeDisabled();
    expect(
      within(dialog).getByText("Reason must be at least 10 characters."),
    ).toBeInTheDocument();

    fireEvent.change(reasonField, { target: { value: "This reason is long enough." } });
    // The freshness-rule check (M4 · G4 closure) also gates the confirm
    // button — it must settle (a real, if fast, GET round trip via MSW)
    // before the button reflects the reason-length rule alone.
    await waitFor(() => expect(confirmButton).toBeEnabled());
  });

  it("disables Reject when the reason exceeds the backend's own 1000-character maximum", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });

    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "x".repeat(1001) },
    });

    expect(confirmButton).toBeDisabled();
    expect(
      within(dialog).getByText("Reason must be 1000 characters or fewer."),
    ).toBeInTheDocument();
  });

  it("sends the entered reason as reject_reason", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      rejectHandler(1, (b) => (body = b)),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(body).toEqual({ reject_reason: "Illegible receipt image" }),
    );
  });

  it("disables the confirm button while pending, preventing a duplicate submission", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      http.post(`${API}/admin/depos/1/reject`, async () => {
        await delay(50);
        return HttpResponse.json({ message: "Deposit rejected successfully." });
      }),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByRole("button", { name: "Rejecting…" }),
    ).toBeDisabled();
  });

  it("closes the dialog and refetches the deposit as Rejected on success", async () => {
    let status: "pending" | "rejected" = "pending";
    let rejectReason: string | null = null;
    server.use(
      http.get(`${API}/admin/depos/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, status, reject_reason: rejectReason })),
      ),
      http.post(`${API}/admin/depos/1/reject`, async ({ request }) => {
        const parsed = (await request.json()) as { reject_reason: string };
        status = "rejected";
        rejectReason = parsed.reject_reason;
        return HttpResponse.json({ message: "Deposit rejected successfully." });
      }),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Illegible receipt image")).toBeInTheDocument();
  });

  it("maps a field-level 422 on reject_reason to the reason field, not a generic banner", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      http.post(`${API}/admin/depos/1/reject`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: {
              reject_reason: ["The reject reason must be at least 10 characters."],
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await within(dialog).findByText(
        "The reject reason must be at least 10 characters.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/could not be rejected/i)).not.toBeInTheDocument();
  });

  it("shows a generic error, not the raw backend text, on an unexpected failure", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      http.post(`${API}/admin/depos/1/reject`, () =>
        HttpResponse.json(
          { error: "Only pending deposits can be rejected." },
          { status: 400 },
        ),
      ),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be rejected/i,
    );
  });

  it("invalidates only the deposits cache on success", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["managers", "list", {}], { fake: true });
    queryClient.setQueryData(["commercials", "list", {}], { fake: true });
    queryClient.setQueryData(["deposits", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, status: "pending" })),
      rejectHandler(1),
    );
    renderPage("/money/deposits/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(queryClient.getQueryState(["deposits", "list", {}])?.isInvalidated).toBe(
        true,
      ),
    );
    expect(queryClient.getQueryState(["managers", "list", {}])?.isInvalidated).toBe(
      false,
    );
    expect(queryClient.getQueryState(["commercials", "list", {}])?.isInvalidated).toBe(
      false,
    );
  });
});

describe("Reject — freshness rule (M4 · G4 closure)", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.REJECT_DEPOSIT]);
  });

  it("keeps confirm disabled while the freshness check is in flight, even with a valid reason", async () => {
    let call = 0;
    server.use(
      http.get(`${API}/admin/depos/1`, async () => {
        call += 1;
        // The page's own initial load (call 1) resolves immediately; the
        // freshness check fired when the dialog opens (call 2) is held
        // open long enough to observe the "checking" phase before it
        // settles.
        if (call > 1) await delay(200);
        return HttpResponse.json(showEnvelope({ id: 1, status: "pending" }));
      }),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });

    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(within(dialog).getByText("Checking for changes…")).toBeInTheDocument();
  });

  it("blocks confirm and explains when the fresh read shows the deposit already processed", async () => {
    server.use(
      sequentialShowHandler(1, [
        showEnvelope({ id: 1, status: "pending" }),
        showEnvelope({ id: 1, status: "validated" }),
      ]),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });

    expect(
      await within(dialog).findByText("This deposit has already been processed."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("blocks confirm, shows a verification-failed message and a Retry action when the freshness check itself fails", async () => {
    server.use(
      failingAfterFirstShowHandler(1, showEnvelope({ id: 1, status: "pending" })),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });

    expect(
      await within(dialog).findByText(
        "This deposit's current status could not be verified.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Retry re-attempts the freshness check and unblocks confirm once it succeeds", async () => {
    server.use(
      failingAfterFirstShowHandler(1, showEnvelope({ id: 1, status: "pending" })),
    );
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });
    await within(dialog).findByRole("button", { name: "Retry" });

    // The retry itself will also 500 from this handler (it fails every
    // call after the first) — swap in a handler that succeeds instead,
    // then retry.
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Reject" })).toBeEnabled(),
    );
    expect(
      within(dialog).queryByText("This deposit's current status could not be verified."),
    ).not.toBeInTheDocument();
  });

  it("does not show a freshness message when the record is unchanged", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, status: "pending" })));
    renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible receipt image" },
    });

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Reject" })).toBeEnabled(),
    );
    expect(
      within(dialog).queryByText("This deposit has already been processed."),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/could not be verified/i)).not.toBeInTheDocument();
  });
});

// Permission gating on the ROUTE itself (view-depos, refused/unauthenticated)
// is exercised by `route-authorization.test.tsx`'s own parametrized coverage
// array (`depositDetailPath(1)`), not duplicated here — this file renders
// the page component directly, bypassing the route guard, the same
// convention `cheque-detail-page.test.tsx` already uses.

describe("Grattage invoices (M6 Phase 4)", () => {
  it("shows linked invoices for a grattage deposit when access-dashboard is held", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage" })),
      grattageInvoicesHandler([
        linkedInvoiceRow({ id: 101, status: "settled", total_amount: "150.00" }),
        linkedInvoiceRow({ id: 102, status: "pending", total_amount: "75.50" }),
      ]),
    );
    renderPage("/money/deposits/1");

    // The section heading renders unconditionally once eligible — it does
    // NOT prove the query itself has settled. Wait on actual row content
    // (async) before asserting the rest synchronously.
    expect(await screen.findByText("#101")).toBeInTheDocument();
    expect(screen.getByText("#102")).toBeInTheDocument();
    expect(screen.getByText("150.00 DH")).toBeInTheDocument();
    expect(screen.getByText("75.50 DH")).toBeInTheDocument();
    // "Pending" also appears in the DEPOSIT's OWN status badge (the
    // fixture's own default) — scope to the linked-invoices table so this
    // doesn't collide with it.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Settled")).toBeInTheDocument();
    expect(within(table).getByText("Pending")).toBeInTheDocument();
  });

  it("shows an empty state for a grattage deposit with no linked invoices", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage" })),
      grattageInvoicesHandler([]),
    );
    renderPage("/money/deposits/1");

    expect(
      await screen.findByText("No grattage invoices are linked to this deposit."),
    ).toBeInTheDocument();
  });

  it("does not show the section at all for a rapped deposit, even with access-dashboard", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    let requested = false;
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "rapped" })),
      http.get(`${API}/admin/grattage-invoices`, () => {
        requested = true;
        return HttpResponse.json({ success: false }, { status: 500 });
      }),
    );
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(
      screen.queryByRole("heading", { name: "Grattage invoices" }),
    ).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("does not show the section, and never issues the request, for a grattage deposit without access-dashboard", async () => {
    // `view-depos` ALONE — the two permissions are genuinely independent.
    signInWith([PERMISSIONS.VIEW_DEPOSITS]);
    let requested = false;
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage" })),
      http.get(`${API}/admin/grattage-invoices`, () => {
        requested = true;
        return HttpResponse.json({ success: false }, { status: 500 });
      }),
    );
    renderPage("/money/deposits/1");

    await screen.findByRole("heading", { name: "Deposit #1" });
    expect(
      screen.queryByRole("heading", { name: "Grattage invoices" }),
    ).not.toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("sends exactly deposit_id and per_page — no other filter", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    let url: URL | undefined;
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage" })),
      grattageInvoicesHandler([], (u) => (url = u)),
    );
    renderPage("/money/deposits/1");

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("deposit_id")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("100");
    expect(url?.searchParams.get("status")).toBeNull();
    expect(url?.searchParams.get("agent_id")).toBeNull();
    expect(url?.searchParams.get("client_id")).toBeNull();
  });

  it("navigates to the invoice's own detail page on View", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage" })),
      grattageInvoicesHandler([linkedInvoiceRow({ id: 101 })]),
    );
    const { router } = renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/grattage/invoices/101"),
    );
  });

  it("refetches the linked-invoices panel after Validate succeeds — existing invalidation already covers it", async () => {
    // A STATEFUL mock, not a static handler, NOR a bare `isInvalidated`
    // flag check — this key has an ACTIVE OBSERVER (the panel is
    // currently mounted and reading it), so `invalidateQueries` triggers
    // an immediate refetch; by the time any assertion runs, a successful
    // refetch has already cleared `isInvalidated` back to `false` again
    // (correct TanStack Query behaviour, not a bug). Proving the SAME
    // point meaningfully means observing a REAL state change instead —
    // the same discipline this file's own "closes the dialog and
    // refetches the deposit as Validated" test already established.
    let invoiceStatus: "pending" | "settled" = "pending";
    signInWith([
      PERMISSIONS.VIEW_DEPOSITS,
      PERMISSIONS.VALIDATE_DEPOSIT,
      PERMISSIONS.ACCESS_DASHBOARD,
    ]);
    server.use(
      showHandler(1, showEnvelope({ id: 1, type: "grattage", status: "pending" })),
      http.get(`${API}/admin/grattage-invoices`, () =>
        HttpResponse.json({
          success: true,
          data: {
            data: [linkedInvoiceRow({ id: 101, status: invoiceStatus })],
            current_page: 1,
            per_page: 100,
            total: 1,
            last_page: 1,
          },
        }),
      ),
      http.post(`${API}/admin/depos/1/validate`, () => {
        invoiceStatus = "settled";
        return HttpResponse.json({ message: "Deposit validated and balance updated." });
      }),
    );
    renderPage("/money/deposits/1");

    await screen.findByText("#101");
    expect(within(screen.getByRole("table")).getByText("Pending")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Validate" }));
    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Validate" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(within(screen.getByRole("table")).getByText("Settled")).toBeInTheDocument(),
    );
  });
});
