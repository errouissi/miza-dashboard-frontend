import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
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
    proof_type: string;
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

function renderPage(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: DETAIL_PATTERN, element: <DepositDetailPage /> },
      { path: DEPOSITS_PATH, element: <p>Deposits list</p> },
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

  it("renders proof_type directly, no placeholder needed", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, proof_type: "whatsapp_confirmation" })),
    );
    renderPage("/money/deposits/1");

    expect(await screen.findByText("whatsapp_confirmation")).toBeInTheDocument();
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
    const router = renderPage("/money/deposits/1");

    fireEvent.click(await screen.findByRole("button", { name: "Back to Deposits" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEPOSITS_PATH));
  });
});

// Permission gating on the ROUTE itself (view-depos, refused/unauthenticated)
// is exercised by `route-authorization.test.tsx`'s own parametrized coverage
// array (`depositDetailPath(1)`), not duplicated here — this file renders
// the page component directly, bypassing the route guard, the same
// convention `cheque-detail-page.test.tsx` already uses.
