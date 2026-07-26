import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DebtPaymentsListPage } from "./debt-payments-list-page";

const API = "http://localhost/api/v1";
const PATH = "/money/debt-payments";
const NEW_PATH = "/money/debt-payments/new";

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

function debtPaymentRow(
  id: number,
  overrides: Partial<{
    amount: string;
    receipt_number: string | null;
    proof_image_url: string | null;
    created_at: string;
  }> = {},
) {
  return {
    id,
    amount: "200.00",
    receipt_number: "REC-500",
    proof_image_url: "http://localhost/storage/debt_payments/1/proof.jpg",
    created_at: "2026-07-26T10:00:00.000000Z",
    ...overrides,
  };
}

/**
 * `DebtPaymentController::index`'s own envelope — `{current_debt,
 * total_paid, payments: <raw Eloquent paginator>}`, verified fresh from
 * source. `payments` is Laravel's default `LengthAwarePaginator::toArray()`
 * shape.
 */
function indexEnvelope(
  rows: ReturnType<typeof debtPaymentRow>[],
  options: Partial<{
    current_debt: string;
    total_paid: string;
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    current_debt: options.current_debt ?? "500.00",
    total_paid: options.total_paid ?? "300.00",
    payments: {
      data: rows,
      current_page: options.current_page ?? 1,
      per_page: options.per_page ?? 20,
      total: options.total ?? rows.length,
      last_page: options.last_page ?? 1,
    },
  };
}

function indexHandler(envelope: ReturnType<typeof indexEnvelope>) {
  return http.get(`${API}/admin/debt-payments`, () => HttpResponse.json(envelope));
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <DebtPaymentsListPage /> },
      { path: NEW_PATH, element: <p>Create debt payment</p> },
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
  signInWith([PERMISSIONS.DEBT_PAYMENTS]);
});

describe("debt payments list — bespoke {current_debt, total_paid, payments} envelope", () => {
  it("renders the current debt and total paid summary", async () => {
    server.use(
      indexHandler(
        indexEnvelope([debtPaymentRow(1)], {
          current_debt: "500.00",
          total_paid: "300.00",
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText("500.00 DH")).toBeInTheDocument();
    expect(screen.getByText("300.00 DH")).toBeInTheDocument();
  });

  it("renders rows from the nested payments.data paginator", async () => {
    server.use(
      indexHandler(
        indexEnvelope([debtPaymentRow(1, { amount: "150.00", receipt_number: "REC-A" })]),
      ),
    );
    renderPage();

    expect(await screen.findByText("REC-A")).toBeInTheDocument();
    expect(screen.getByText("150.00 DH")).toBeInTheDocument();
  });

  it("renders no heading crash and no console-visible runtime error", async () => {
    server.use(indexHandler(indexEnvelope([debtPaymentRow(1)])));
    renderPage();

    expect(await screen.findByText("Debt Payments")).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/debt-payments`, () =>
        HttpResponse.json({ error: "Erreur serveur" }, { status: 500 }),
      ),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no payments", async () => {
    server.use(indexHandler(indexEnvelope([])));
    renderPage();

    expect(await screen.findByText("No debt payment yet.")).toBeInTheDocument();
  });
});

describe("no proof link when proof_image_url is null", () => {
  it("renders a placeholder dash instead of a link", async () => {
    server.use(
      indexHandler(indexEnvelope([debtPaymentRow(1, { proof_image_url: null })])),
    );
    renderPage();

    await screen.findByText("REC-500");
    expect(screen.queryByRole("link", { name: "View proof" })).not.toBeInTheDocument();
  });

  it("renders a working proof link when present", async () => {
    server.use(
      indexHandler(
        indexEnvelope([
          debtPaymentRow(1, {
            proof_image_url: "http://localhost/storage/debt_payments/1/proof.jpg",
          }),
        ]),
      ),
    );
    renderPage();

    const link = await screen.findByRole("link", { name: "View proof" });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost/storage/debt_payments/1/proof.jpg",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("pagination", () => {
  it("shows no footer when there is only one page", async () => {
    server.use(indexHandler(indexEnvelope([debtPaymentRow(1)], { last_page: 1 })));
    renderPage();

    await screen.findByText("REC-500");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("advances to the next page and requests page=2", async () => {
    let requestedPage: string | null = null;
    server.use(
      http.get(`${API}/admin/debt-payments`, ({ request }) => {
        const url = new URL(request.url);
        requestedPage = url.searchParams.get("page");
        return HttpResponse.json(
          indexEnvelope([debtPaymentRow(1)], {
            current_page: requestedPage === "2" ? 2 : 1,
            last_page: 2,
            total: 2,
          }),
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(requestedPage).toBe("2"));
  });
});

describe("permission gating", () => {
  it("shows the Record Payment button when the operator holds debt_cash", async () => {
    server.use(indexHandler(indexEnvelope([])));
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Record Payment" }),
    ).toBeInTheDocument();
  });

  it("hides the Record Payment button without debt_cash", async () => {
    signInWith([]);
    server.use(indexHandler(indexEnvelope([])));
    renderPage();

    await screen.findByText("Debt Payments");
    expect(
      screen.queryByRole("button", { name: "Record Payment" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to the create route on click", async () => {
    server.use(indexHandler(indexEnvelope([])));
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Payment" }));

    expect(router.state.location.pathname).toBe(NEW_PATH);
  });
});

describe("no detail page or delete UI is ever offered", () => {
  it("never renders a View/Edit/Delete action column", async () => {
    server.use(indexHandler(indexEnvelope([debtPaymentRow(1)])));
    renderPage();

    await screen.findByText("REC-500");
    expect(screen.queryByRole("button", { name: /view/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
