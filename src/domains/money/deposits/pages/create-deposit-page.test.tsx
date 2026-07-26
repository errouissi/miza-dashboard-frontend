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
import { CreateDepositPage } from "./create-deposit-page";

/**
 * Submission tests mock `httpClient.post` directly, NOT MSW — the same,
 * empirically-verified reason `CreateChequePage`'s own tests do (a
 * `FormData` containing a real `File` hangs indefinitely under this
 * jsdom+MSW test setup). Every non-submission test (rendering, validation,
 * the merged agent picker, the Amount auto-population reads) posts nothing
 * and is unaffected, so those keep using real MSW handlers.
 */

const API = "http://localhost/api/v1";
const PATH = "/money/deposits/new";
const DEPOSITS_PATH = "/money/deposits";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const ALL_CREATE_DEPOSIT_PERMISSIONS = [
  PERMISSIONS.CREATE_DEPOSIT,
  PERMISSIONS.VIEW_AGENTS,
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

function managersHandler() {
  return http.get(`${API}/admin/agents/managers`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 10,
            nom: "Idrissi",
            prenom: "Youssef",
            status: "active",
            num_abonnement: null,
            num_de_compte: "MG0010",
            avance_total: "0.00",
            ville: null,
            ville_sous_responsabilite: null,
            nombre_commerciaux: 0,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

function commercialsHandler() {
  return http.get(`${API}/admin/agents/commercials`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [
          {
            id: 20,
            nom: "Bennani",
            prenom: "Amine",
            status: "active",
            num_abonnement: null,
            num_de_compte: "CM0020",
            avance_total: "0.00",
            ville_actuelle: null,
            manager: null,
            date_debut: null,
            photo_path: null,
          },
        ],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

/** `AgentController::show`'s own envelope — `{success, role, agent: {...}}`, NOT `{data:{...}}`. */
function agentCashHandler(agentId: number, cash: string) {
  return http.get(`${API}/admin/agents/${agentId}`, () =>
    HttpResponse.json({ success: true, role: "manager", agent: { id: agentId, cash } }),
  );
}

/** `AgentController::grattageOutstanding`'s own envelope (Phase 5.10 Commit 5). */
function grattageOutstandingHandler(
  agentId: number,
  requiredTotal: string,
  invoiceCount: number,
) {
  return http.get(`${API}/admin/agents/${agentId}/grattage-outstanding`, () =>
    HttpResponse.json({
      success: true,
      data: {
        agent: { id: agentId, nom: "Idrissi", prenom: "Youssef", role: "manager" },
        summary: {
          required_total: requiredTotal,
          pending_total: requiredTotal,
          overdue_total: "0.00",
          invoice_count: invoiceCount,
          oldest_due_at: null,
        },
        restock_gate: { blocked: false, reason: null },
      },
    }),
  );
}

/** `store()`'s own flat envelope — `{"message": ..., "data": new DepoResource(...)}`. */
const CREATE_DEPOSIT_ENVELOPE = {
  message: "Deposit created",
  data: {
    id: 501,
    amount: 500,
    status: "pending",
    type: "rapped",
    method: "bank",
    receipt: "REC-9001",
    proof_url: "http://localhost/storage/agents/managers/depos/proofs/proof.jpg",
    date: "2026-07-26 10:00",
    reject_reason: null,
    validated_by: null,
    validated_at: null,
    bank_name: "Attijariwafa",
    proof_type: "bank_receipt",
    agent: {
      id: 10,
      full_name: "Youssef Idrissi",
      account_number: "MG0010",
      photo: null,
    },
    created_by: "Ahmed Errouissi",
  },
};

const validImage = (name = "proof.jpg") => new File(["x"], name, { type: "image/jpeg" });

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateDepositPage /> },
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

async function selectAgent() {
  const agentSelect = await screen.findByRole("combobox", { name: /agent/i });
  await within(agentSelect).findByRole("option", { name: "Youssef Idrissi" });
  fireEvent.change(agentSelect, { target: { value: "10" } });
}

async function fillValidRappedForm() {
  await selectAgent();
  await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("500.00"));
  fireEvent.change(screen.getByLabelText(/deposit method/i), {
    target: { value: "bank" },
  });
  fireEvent.change(screen.getByLabelText("Proof image"), {
    target: { files: [validImage()] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_CREATE_DEPOSIT_PERMISSIONS);
});

describe("rendering", () => {
  it("renders the backend-supported fields, defaulting Type to rapped and Proof type to bank receipt", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByRole("combobox", { name: /agent/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^type$/i)).toHaveValue("rapped");
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/deposit method/i)).toHaveValue("");
    expect(screen.getByLabelText(/receipt number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/proof type/i)).toHaveValue("bank_receipt");
    expect(screen.getByLabelText("Proof image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Deposit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("bank name is always visible regardless of deposit method — no UI-only conditional", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    fireEvent.change(await screen.findByLabelText(/deposit method/i), {
      target: { value: "cash" },
    });

    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
  });
});

describe("Amount auto-population", () => {
  it("fills Amount from the agent's cash on the rapped branch", async () => {
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await selectAgent();

    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("500.00"));
  });

  it("fills Amount from the grattage outstanding total when Type is switched to grattage", async () => {
    server.use(
      managersHandler(),
      commercialsHandler(),
      agentCashHandler(10, "500.00"),
      grattageOutstandingHandler(10, "250.00", 2),
    );
    renderPage();

    await selectAgent();
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("500.00"));

    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "grattage" } });

    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("250.00"));
    expect(screen.getByText(/2 invoices/i)).toBeInTheDocument();
  });

  it("clears Amount immediately on a type switch, not showing the stale value", async () => {
    server.use(
      managersHandler(),
      commercialsHandler(),
      agentCashHandler(10, "500.00"),
      grattageOutstandingHandler(10, "250.00", 1),
    );
    renderPage();

    await selectAgent();
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("500.00"));

    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "grattage" } });

    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("250.00"));
  });
});

describe("validation", () => {
  it("shows a required error for Agent, Deposit method, Amount and Proof image on an empty submit", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Create Deposit" }));

    expect(await screen.findByText("Agent is required.")).toBeInTheDocument();
    expect(screen.getByText("Deposit method is required.")).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Proof image is required.")).toBeInTheDocument();
  });
});

describe("agent picker", () => {
  it("merges Managers and Commercials into one picker, sorted by name", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    const agentSelect = await screen.findByRole("combobox", { name: /agent/i });
    await waitFor(() =>
      expect(
        within(agentSelect)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Select an agent", "Amine Bennani", "Youssef Idrissi"]),
    );
  });
});

describe("submission — FormData payload and success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a multipart request with the exact wire field names", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_DEPOSIT_ENVELOPE });
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(url).toBe("/admin/depos");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("agent_id")).toBe("10");
    expect(body.get("deposit_method")).toBe("bank");
    expect(body.get("amount")).toBe("500.00");
    expect(body.get("type")).toBe("rapped");
    expect(body.get("proof_type")).toBe("bank_receipt");
    expect(body.get("proof_image")).toBeInstanceOf(File);
    // Optional fields left blank are OMITTED, not sent empty.
    expect(body.get("receipt_number")).toBeNull();
    expect(body.get("bank_name")).toBeNull();
  });

  it("includes receipt_number and bank_name only when filled in", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_DEPOSIT_ENVELOPE });
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.change(screen.getByLabelText(/receipt number/i), {
      target: { value: "REC-9001" },
    });
    fireEvent.change(screen.getByLabelText(/bank name/i), {
      target: { value: "Attijariwafa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(body.get("receipt_number")).toBe("REC-9001");
    expect(body.get("bank_name")).toBe("Attijariwafa");
  });

  it("shows the pending label and disables the button while the request is in flight", async () => {
    let resolvePost:
      ((value: { data: typeof CREATE_DEPOSIT_ENVELOPE }) => void) | undefined;
    vi.spyOn(httpClient, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    expect(await screen.findByRole("button", { name: "Creating…" })).toBeDisabled();
    resolvePost?.({ data: CREATE_DEPOSIT_ENVELOPE });
  });

  it("navigates to the Deposits list on success", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({ data: CREATE_DEPOSIT_ENVELOPE });
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    const router = renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEPOSITS_PATH));
  });
});

describe("Cancel", () => {
  it("navigates to the Deposits list without submitting", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    const router = renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(DEPOSITS_PATH);
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
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    const router = renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    expect(
      await screen.findByText(/something went wrong creating this deposit/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText(/deposit method/i)).toHaveValue("bank");
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
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    expect(
      await screen.findByText("The receipt number has already been taken."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong creating this deposit/i),
    ).not.toBeInTheDocument();
  });

  it("shows a permission-specific message on a 403", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "permission", status: 403, message: "Forbidden" }),
    );
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    expect(
      await screen.findByText(/you do not have permission to create a deposit/i),
    ).toBeInTheDocument();
  });

  it("shows domain-owned copy, not the raw backend text, on a cash-mismatch 422 (no fieldErrors, kind unknown)", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "unknown",
        status: 422,
        message: "Amount must match agent cash (500.00 DH).",
      }),
    );
    server.use(managersHandler(), commercialsHandler(), agentCashHandler(10, "500.00"));
    renderPage();

    await fillValidRappedForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Deposit" }));

    expect(
      await screen.findByText(/this amount no longer matches what's required/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/amount must match agent cash/i)).not.toBeInTheDocument();
  });
});
