import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { httpClient } from "@/infrastructure/http";
import { AppError } from "@/infrastructure/errors";
import { CreateDebtPaymentPage } from "./create-debt-payment-page";

/**
 * Submission tests mock `httpClient.post` directly, NOT MSW — the same,
 * empirically-verified reason `CreateChequePage`'s/`CreateDepositPage`'s own
 * tests do (a `FormData` containing a real `File` hangs indefinitely under
 * this jsdom+MSW test setup). The list-query read this page ALSO performs
 * (for `current_debt`) uses a real MSW handler, since that request carries
 * no file.
 */

const API = "http://localhost/api/v1";
const PATH = "/money/debt-payments/new";
const DEBT_PAYMENTS_PATH = "/money/debt-payments";

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

function indexHandler(currentDebt = "500.00") {
  return http.get(`${API}/admin/debt-payments`, () =>
    HttpResponse.json({
      current_debt: currentDebt,
      total_paid: "300.00",
      payments: { data: [], current_page: 1, per_page: 20, total: 0, last_page: 1 },
    }),
  );
}

/** `store()`'s own flat envelope — `{message, data: <row>, new_debt}`. */
const CREATE_DEBT_PAYMENT_ENVELOPE = {
  message: "Paiement enregistré avec succès.",
  data: {
    id: 900,
    amount: "150.00",
    receipt_number: "REC-9001",
    proof_image_url: "http://localhost/storage/debt_payments/1/proof.jpg",
    created_at: "2026-07-26T10:00:00.000000Z",
  },
  new_debt: "350.00",
};

const validImage = (name = "proof.jpg") => new File(["x"], name, { type: "image/jpeg" });
const validPdf = (name = "proof.pdf") =>
  new File(["x"], name, { type: "application/pdf" });

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateDebtPaymentPage /> },
      { path: DEBT_PAYMENTS_PATH, element: <p>Debt payments list</p> },
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

async function fillValidForm() {
  await screen.findByText(/your current debt is 500.00 dh/i);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "150" } });
  fireEvent.change(screen.getByLabelText(/receipt number/i), {
    target: { value: "REC-9001" },
  });
  fireEvent.change(screen.getByLabelText("Proof"), {
    target: { files: [validImage()] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.DEBT_PAYMENTS]);
});

describe("rendering", () => {
  it("renders the three backend-supported fields and the current debt", async () => {
    server.use(indexHandler("500.00"));
    renderPage();

    expect(
      await screen.findByText(/your current debt is 500.00 dh/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/receipt number/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Proof")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("validation", () => {
  it("shows a required error for every field on an empty submit", async () => {
    server.use(indexHandler());
    renderPage();
    await screen.findByText(/your current debt is/i);

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(await screen.findByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Receipt number is required.")).toBeInTheDocument();
    expect(screen.getByText("Proof image is required.")).toBeInTheDocument();
  });

  it("rejects a non-numeric amount", async () => {
    server.use(indexHandler());
    renderPage();
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(await screen.findByText("Enter a valid number.")).toBeInTheDocument();
  });

  it("rejects an amount below 0.01", async () => {
    server.use(indexHandler());
    renderPage();
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(await screen.findByText("Amount must be at least 0.01.")).toBeInTheDocument();
  });
});

describe("client-side ceiling — a UX mirror only, never a hard block on the backend's own decision", () => {
  it("shows a warning and disables submit when amount exceeds current debt", async () => {
    server.use(indexHandler("100.00"));
    renderPage();
    await screen.findByText(/your current debt is 100.00 dh/i);

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/receipt number/i), {
      target: { value: "REC-1" },
    });
    fireEvent.change(screen.getByLabelText("Proof"), {
      target: { files: [validImage()] },
    });

    expect(
      await screen.findByText("This exceeds your current debt of 100.00 DH."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Payment" })).toBeDisabled();
  });

  it("does not warn or disable submit for an amount within the current debt", async () => {
    server.use(indexHandler("500.00"));
    renderPage();
    await fillValidForm();

    expect(screen.queryByText(/exceeds your current debt/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Payment" })).not.toBeDisabled();
  });
});

describe("submission — FormData payload and success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a multipart request with the exact wire field names", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_DEBT_PAYMENT_ENVELOPE });
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(url).toBe("/admin/debt-payments");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("amount")).toBe("150");
    expect(body.get("receipt_number")).toBe("REC-9001");
    expect(body.get("proof_image")).toBeInstanceOf(File);
  });

  it("accepts a PDF proof file, not just images", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_DEBT_PAYMENT_ENVELOPE });
    server.use(indexHandler());
    renderPage();

    await screen.findByText(/your current debt is/i);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/receipt number/i), {
      target: { value: "REC-9001" },
    });
    fireEvent.change(screen.getByLabelText("Proof"), { target: { files: [validPdf()] } });
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    const proof = body.get("proof_image") as File;
    expect(proof.type).toBe("application/pdf");
  });

  it("shows the pending label and disables the button while the request is in flight", async () => {
    let resolvePost:
      ((value: { data: typeof CREATE_DEBT_PAYMENT_ENVELOPE }) => void) | undefined;
    vi.spyOn(httpClient, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(await screen.findByRole("button", { name: "Recording…" })).toBeDisabled();
    resolvePost?.({ data: CREATE_DEBT_PAYMENT_ENVELOPE });
  });

  it("navigates to the Debt Payments list on success", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({
      data: CREATE_DEBT_PAYMENT_ENVELOPE,
    });
    server.use(indexHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEBT_PAYMENTS_PATH));
  });
});

describe("Cancel", () => {
  it("navigates to the Debt Payments list without submitting", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(indexHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(DEBT_PAYMENTS_PATH);
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });
});

describe("backend validation responses — both real failure shapes handled correctly", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a general error and does not navigate on a server failure", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "server", status: 500, message: "boom" }),
    );
    server.use(indexHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(
      await screen.findByText(/something went wrong recording this payment/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText(/receipt number/i)).toHaveValue("REC-9001");
  });

  it("maps a field-level 422 (e.g. a duplicate receipt number) to its own field, not a generic banner", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "validation",
        status: 422,
        message: "The given data was invalid.",
        fieldErrors: { receipt_number: ["The receipt number has already been taken."] },
      }),
    );
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(
      await screen.findByText("The receipt number has already been taken."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong recording this payment/i),
    ).not.toBeInTheDocument();
  });

  it("maps the ceiling-exceeded rule as an ORDINARY field-level 422 on amount, backend text verbatim (it is a validate() closure, not a bare {error} response)", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "validation",
        status: 422,
        message: "The given data was invalid.",
        fieldErrors: {
          amount: ["Le montant ne peut pas dépasser votre dette actuelle (500.00 DH)."],
        },
      }),
    );
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(
      await screen.findByText(
        "Le montant ne peut pas dépasser votre dette actuelle (500.00 DH).",
      ),
    ).toBeInTheDocument();
  });

  it("shows domain-owned copy, not raw backend text, for the bare {error} 'nothing to repay' response", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "unknown",
        status: 422,
        message: "Vous n'avez pas de dette à rembourser.",
      }),
    );
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(
      await screen.findByText("You have no outstanding debt to repay."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/vous n'avez pas de dette/i)).not.toBeInTheDocument();
  });

  it("shows a permission-specific message on a 403", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "permission", status: 403, message: "Forbidden" }),
    );
    server.use(indexHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    expect(
      await screen.findByText(/you do not have permission to record a debt payment/i),
    ).toBeInTheDocument();
  });
});
