import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { httpClient } from "@/infrastructure/http";
import { AppError } from "@/infrastructure/errors";
import { CreateBonPage } from "./create-bon-page";

/**
 * Submission tests mock `httpClient.post` directly, NOT MSW — the same,
 * empirically-verified reason Cheques' own submission tests do
 * (`create-cheque-page.test.tsx`'s own docblock): a `FormData` containing
 * a real `File` hangs indefinitely under this jsdom+MSW test setup. Every
 * non-submission test (rendering, validation, the supplier/company
 * pickers) posts nothing and is unaffected, so those keep using real MSW
 * handlers.
 */

const API = "http://localhost/api/v1";
const PATH = "/stock/bons/new";
const BONS_PATH = "/stock/bons";
const DETAIL_PATH = "/stock/bons/:id";

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

function suppliersHandler() {
  return http.get(`${API}/admin/suppliers`, () =>
    HttpResponse.json([
      { id: 7, name: "Default Supplier", code: "DEFAULT", active: true },
    ]),
  );
}

function companiesHandler() {
  return http.get(`${API}/admin/companies`, () =>
    HttpResponse.json([{ id: 5, name: "Miza", code: "MIZA", active: true }]),
  );
}

/** `store()`'s own flat envelope — `{"data": new BonResource(...)}`. */
const CREATE_BON_ENVELOPE = {
  data: {
    id: 900,
    bon_number: "BON-900",
    status: "draft",
    admin_id: 1,
    supplier_id: 7,
    company_id: 5,
    notes: null,
    evidence_url: "http://localhost/storage/bons/2026/08/supplier_7/evidence_abc.pdf",
    evidence_name: "evidence_abc.pdf",
    montant: "0.00",
    received_at: null,
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-08-05T09:00:00Z",
    updated_at: "2026-08-05T09:00:00Z",
    supplier: { id: 7, name: "Default Supplier" },
    company: { id: 5, name: "Miza" },
    creator: { id: 1, name: "Ahmed Errouissi" },
    approver: null,
  },
};

const validEvidence = (name = "invoice.pdf") =>
  new File(["x"], name, { type: "application/pdf" });

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateBonPage /> },
      { path: BONS_PATH, element: <p>Bons list</p> },
      { path: DETAIL_PATH, element: <p>Bon detail</p> },
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
  fireEvent.change(await screen.findByLabelText("Bon number"), {
    target: { value: "BON-900" },
  });
  const supplierSelect = await screen.findByLabelText("Supplier");
  await within(supplierSelect).findByRole("option", { name: "Default Supplier" });
  fireEvent.change(supplierSelect, { target: { value: "7" } });
  const companySelect = await screen.findByLabelText("Company");
  await within(companySelect).findByRole("option", { name: "Miza" });
  fireEvent.change(companySelect, { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Evidence"), {
    target: { files: [validEvidence()] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.CREATE_BON, PERMISSIONS.ACCESS_DASHBOARD]);
});

describe("rendering", () => {
  it("renders the backend-supported fields — two independent selects, no cascade", async () => {
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    expect(await screen.findByLabelText("Bon number")).toBeInTheDocument();
    expect(screen.getByLabelText("Supplier")).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
    expect(screen.getByLabelText("Received date")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Bon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("validation", () => {
  it("shows a required error for every required field on an empty submit", async () => {
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Bon" }));

    expect(await screen.findByText("Bon number is required.")).toBeInTheDocument();
    expect(screen.getByText("Supplier is required.")).toBeInTheDocument();
    expect(screen.getByText("Company is required.")).toBeInTheDocument();
    expect(screen.getByText("Evidence is required.")).toBeInTheDocument();
  });

  it("rejects a future received date, mirroring the backend's own refusal", async () => {
    server.use(suppliersHandler(), companiesHandler());
    renderPage();
    await fillValidForm();

    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureDate = future.toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("Received date"), {
      target: { value: futureDate },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    expect(
      await screen.findByText("Received date must not be in the future."),
    ).toBeInTheDocument();
  });

  it("rejects an oversized evidence file", async () => {
    server.use(suppliersHandler(), companiesHandler());
    renderPage();
    await fillValidForm();

    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Evidence"), { target: { files: [big] } });
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    expect(await screen.findByText("File must be 5MB or smaller.")).toBeInTheDocument();
  });
});

describe("submission — FormData payload and success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a multipart request with the exact wire field names, omitting blank optional fields", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_BON_ENVELOPE });
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(url).toBe("/admin/bons");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("bon_number")).toBe("BON-900");
    expect(body.get("supplier_id")).toBe("7");
    expect(body.get("company_id")).toBe("5");
    expect(body.get("evidence")).toBeInstanceOf(File);
    expect(body.get("notes")).toBeNull();
    expect(body.get("received_at")).toBeNull();
  });

  it("includes notes and received_at only when filled in", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_BON_ENVELOPE });
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    await fillValidForm();
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Delivered on site" },
    });
    fireEvent.change(screen.getByLabelText("Received date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(body.get("notes")).toBe("Delivered on site");
    expect(body.get("received_at")).toBe("2026-08-01");
  });

  it("navigates to the new bon's own detail page on success", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({ data: CREATE_BON_ENVELOPE });
    server.use(suppliersHandler(), companiesHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/stock/bons/900"));
  });
});

describe("Cancel", () => {
  it("navigates to the list without submitting", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(suppliersHandler(), companiesHandler());
    const router = renderPage();

    await screen.findByLabelText("Bon number");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(BONS_PATH);
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });
});

describe("failure preserves entered values", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a general error and does not navigate on a server failure", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "server", status: 500, message: "boom" }),
    );
    server.use(suppliersHandler(), companiesHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    expect(
      await screen.findByText(/something went wrong recording this bon/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText("Bon number")).toHaveValue("BON-900");
  });

  it("maps a field-level 422 (e.g. a duplicate bon number) to its own field", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "validation",
        status: 422,
        message: "The given data was invalid.",
        fieldErrors: { bon_number: ["The bon number has already been taken."] },
      }),
    );
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    expect(
      await screen.findByText("The bon number has already been taken."),
    ).toBeInTheDocument();
  });

  it("shows a permission-specific message on a 403", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "permission", status: 403, message: "Forbidden" }),
    );
    server.use(suppliersHandler(), companiesHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Record Bon" }));

    expect(
      await screen.findByText(/you do not have permission to record a bon/i),
    ).toBeInTheDocument();
  });
});
