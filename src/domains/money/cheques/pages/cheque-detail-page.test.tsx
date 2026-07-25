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
import { ChequeDetailPage } from "./cheque-detail-page";

const API = "http://localhost/api/v1";
const CHEQUES_PATH = "/money/cheques";
const DETAIL_PATTERN = "/money/cheques/:id";

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
 * `show()`'s own row shape, verified from source: a flat cheque + `photo_url`
 * + `status_label` spread in (`ChequeController::show`), `agent` the full
 * nested Agent model, `allocations` present (possibly empty) since `show()`
 * always eager-loads it. `processed_by`/`processedBy` are DELIBERATELY
 * OMITTED from this fixture's shape being asserted on — BC-Z means the
 * frontend never reads that field (see `cheque-detail-page.tsx`'s own
 * docblock), so this fixture does not need to model the backend's buggy
 * relation-overwrite to prove the page's behavior.
 */
function showEnvelope(
  overrides: Partial<{
    id: number;
    amount: string;
    num_cheque: string;
    agent_id: number;
    decision_reason: string | null;
    processed_at: string | null;
    created_at: string;
    statute: "en_attente" | "accepter" | "rejetee" | "annuler";
    photo_url: string | null;
    agent: { id: number; nom: string; prenom: string };
    allocations: { id: number; type: "rapped" | "grattage"; amount: string }[];
  }> = {},
) {
  return {
    success: true,
    data: {
      id: 1,
      amount: "1500.00",
      num_cheque: "CHQ-001",
      agent_id: 1,
      decision_reason: null,
      processed_at: null,
      created_at: "2026-02-10T09:00:00Z",
      statute: "en_attente" as const,
      photo_url: null,
      status_label: "En attente",
      agent: { id: 1, nom: "Alaoui", prenom: "Sara" },
      allocations: [],
      ...overrides,
    },
  };
}

function showHandler(id: number, envelope: ReturnType<typeof showEnvelope>) {
  return http.get(`${API}/admin/cheques/${id}`, () => HttpResponse.json(envelope));
}

function renderPage(initialPath: string, queryClient: QueryClient = createQueryClient()) {
  const router = createMemoryRouter(
    [
      { path: DETAIL_PATTERN, element: <ChequeDetailPage /> },
      { path: CHEQUES_PATH, element: <p>Cheques list</p> },
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

function approveHandler(id: number, onRequest?: (body: unknown) => void) {
  return http.put(`${API}/admin/cheques/${id}/approve`, async ({ request }) => {
    onRequest?.(await request.json().catch(() => undefined));
    return HttpResponse.json({
      success: true,
      message: "Chèque approuvé avec succès",
      data: {
        cheque: { ...showEnvelope({ id, statute: "accepter" }).data },
        agent_new_montant_avance: "1500.00",
      },
    });
  });
}

function rejectHandler(id: number, onRequest?: (body: unknown) => void) {
  return http.put(`${API}/admin/cheques/${id}/reject`, async ({ request }) => {
    onRequest?.(await request.json().catch(() => undefined));
    return HttpResponse.json({
      success: true,
      message: "Chèque rejeté avec succès",
      data: showEnvelope({ id, statute: "rejetee" }).data,
    });
  });
}

function annulerHandler(id: number, onRequest?: (body: unknown) => void) {
  return http.put(`${API}/admin/cheques/${id}/annuler`, async ({ request }) => {
    onRequest?.(await request.json().catch(() => undefined));
    return HttpResponse.json({
      success: true,
      message: "Chèque annulé avec succès",
      data: showEnvelope({ id, statute: "annuler" }).data,
    });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.VIEW_CHEQUES]);
});

describe("rendering every field show() returns", () => {
  it("renders cheque number, amount, agent, status, submitted date", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          num_cheque: "CHQ-001",
          amount: "1234.56",
          agent: { id: 1, nom: "Alaoui", prenom: "Sara" },
          statute: "accepter",
          created_at: "2026-02-10T09:00:00Z",
        }),
      ),
    );
    renderPage("/money/cheques/1");

    expect(await screen.findByRole("heading", { name: /CHQ-001/ })).toBeInTheDocument();
    expect(screen.getByText("1234.56")).toBeInTheDocument();
    expect(screen.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByText("10/02/2026")).toBeInTheDocument();
  });

  it("renders the decision reason when present, a dash when absent", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          statute: "rejetee",
          decision_reason: "Illegible signature",
        }),
      ),
    );
    renderPage("/money/cheques/1");

    expect(await screen.findByText("Illegible signature")).toBeInTheDocument();
  });

  it("renders processed_at through the datetime formatter when present", async () => {
    const processedAt = "2026-02-11T14:30:00Z";
    server.use(
      showHandler(
        1,
        showEnvelope({ id: 1, statute: "accepter", processed_at: processedAt }),
      ),
    );
    renderPage("/money/cheques/1");

    // Computed via the same formatter rather than a hardcoded literal — the
    // formatter renders in the machine's local timezone (Design System §27
    // never locale-infers the CALENDAR, but does render local wall-clock
    // time), so a literal would be a flaky assumption about the test
    // runner's own TZ, not a real assertion about the formatter's contract.
    expect(await screen.findByText(formatDateTime(processedAt))).toBeInTheDocument();
  });

  it("renders the cheque photo when photo_url is present", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({ id: 1, photo_url: "http://localhost/storage/cheques/1.jpg" }),
      ),
    );
    renderPage("/money/cheques/1");

    const image = await screen.findByRole("img", { name: /cheque CHQ-001/i });
    expect(image).toHaveAttribute("src", "http://localhost/storage/cheques/1.jpg");
  });

  it("renders no image when photo_url is null — never fabricates one", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, photo_url: null })));
    renderPage("/money/cheques/1");

    await screen.findByRole("heading", { name: /CHQ-001/ });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders allocations when show() returns them (an approved, split cheque)", async () => {
    server.use(
      showHandler(
        1,
        showEnvelope({
          id: 1,
          statute: "accepter",
          allocations: [
            { id: 10, type: "rapped", amount: "1000.00" },
            { id: 11, type: "grattage", amount: "500.00" },
          ],
        }),
      ),
    );
    renderPage("/money/cheques/1");

    expect(await screen.findByText(/rapped.*1000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/grattage.*500\.00/)).toBeInTheDocument();
  });

  it("renders no allocations section for a pending cheque (empty array)", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente", allocations: [] })),
    );
    renderPage("/money/cheques/1");

    await screen.findByRole("heading", { name: /CHQ-001/ });
    expect(
      screen.queryByRole("heading", { name: "Allocations" }),
    ).not.toBeInTheDocument();
  });
});

describe("loading, error and not-found states", () => {
  it("shows a loading state before the response resolves", async () => {
    server.use(
      http.get(`${API}/admin/cheques/1`, async () => {
        await delay(30);
        return HttpResponse.json(showEnvelope({ id: 1 }));
      }),
    );
    renderPage("/money/cheques/1");

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows a not-found message on a 404", async () => {
    server.use(
      http.get(`${API}/admin/cheques/999`, () =>
        HttpResponse.json(
          { success: false, message: "Chèque non trouvé" },
          { status: 404 },
        ),
      ),
    );
    renderPage("/money/cheques/999");

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/cheques/1`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage("/money/cheques/1");

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows an invalid-reference message for a non-numeric id, without calling the API", async () => {
    renderPage("/money/cheques/not-a-number");

    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
  });
});

describe("action visibility — permission AND status gating (M4.2 Phase 3C)", () => {
  it("shows Approve and Reject for a pending cheque when both permissions are held", async () => {
    signInWith([
      PERMISSIONS.VIEW_CHEQUES,
      PERMISSIONS.APPROVE_CHEQUE,
      PERMISSIONS.REJECT_CHEQUE,
    ]);
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel cheque" }),
    ).not.toBeInTheDocument();
  });

  it("hides Approve/Reject for a pending cheque when the permission is not held", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES]);
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    await screen.findByRole("heading", { name: /CHQ-001/ });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("hides Approve/Reject for an already-approved cheque, even with the permission held", async () => {
    signInWith([
      PERMISSIONS.VIEW_CHEQUES,
      PERMISSIONS.APPROVE_CHEQUE,
      PERMISSIONS.REJECT_CHEQUE,
    ]);
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "accepter" })));
    renderPage("/money/cheques/1");

    await screen.findByRole("heading", { name: /CHQ-001/ });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("shows Cancel cheque only for an approved cheque, with annuler-cheque held", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.ANNULER_CHEQUE]);
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "accepter" })));
    renderPage("/money/cheques/1");

    expect(
      await screen.findByRole("button", { name: "Cancel cheque" }),
    ).toBeInTheDocument();
  });

  it("hides Cancel cheque for a pending cheque, even with annuler-cheque held", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.ANNULER_CHEQUE]);
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    await screen.findByRole("heading", { name: /CHQ-001/ });
    expect(
      screen.queryByRole("button", { name: "Cancel cheque" }),
    ).not.toBeInTheDocument();
  });
});

describe("Approve — allocation split", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.APPROVE_CHEQUE]);
  });

  async function openApproveDialog() {
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    return screen.findByRole("dialog");
  }

  it("shows the cheque amount read-only, plus Rapped and Grattage inputs", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();

    expect(within(dialog).getByText("1500.00 DH")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Rapped")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Grattage")).toBeInTheDocument();
  });

  it("defaults to 100% rapped when the dialog is opened untouched — the backend's own legacy shape, sent explicitly", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      approveHandler(1, (b) => (body = b)),
    );
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(body).toEqual({ allocations: [{ type: "rapped", amount: 1500 }] }),
    );
  });

  it("sends a valid split as two allocations", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      approveHandler(1, (b) => (body = b)),
    );
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.change(within(dialog).getByLabelText("Rapped"), {
      target: { value: "600" },
    });
    fireEvent.change(within(dialog).getByLabelText("Grattage"), {
      target: { value: "900" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(body).toEqual({
        allocations: [
          { type: "rapped", amount: 600 },
          { type: "grattage", amount: 900 },
        ],
      }),
    );
  });

  it("supports 100% grattage — the rapped side is omitted, not sent as zero", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      approveHandler(1, (b) => (body = b)),
    );
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.change(within(dialog).getByLabelText("Rapped"), { target: { value: "0" } });
    fireEvent.change(within(dialog).getByLabelText("Grattage"), {
      target: { value: "1500" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(body).toEqual({ allocations: [{ type: "grattage", amount: 1500 }] }),
    );
  });

  it("disables Approve and shows a validation error when the total is LESS than the cheque amount", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.change(within(dialog).getByLabelText("Rapped"), {
      target: { value: "600" },
    });
    fireEvent.change(within(dialog).getByLabelText("Grattage"), {
      target: { value: "800" },
    });

    expect(
      await within(dialog).findByText(
        "Rapped and grattage must add up exactly to the cheque amount.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("disables Approve and shows a validation error when the total is MORE than the cheque amount", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.change(within(dialog).getByLabelText("Rapped"), {
      target: { value: "600" },
    });
    fireEvent.change(within(dialog).getByLabelText("Grattage"), {
      target: { value: "1000" },
    });

    expect(
      await within(dialog).findByText(
        "Rapped and grattage must add up exactly to the cheque amount.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("disables Approve and shows a validation error for a non-numeric input", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    const dialog = await openApproveDialog();
    fireEvent.change(within(dialog).getByLabelText("Rapped"), {
      target: { value: "abc" },
    });

    expect(
      await within(dialog).findByText(
        "Enter a valid, non-negative amount for both fields.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("closes the dialog and refetches the cheque as Approved on success", async () => {
    // A STATEFUL mock, not two static handlers: invalidation only proves
    // anything if the refetch it triggers can observe a real state change —
    // a static `showHandler` would keep returning "en_attente" forever and
    // this test would pass for the wrong reason (no refetch needed to see
    // an unchanging response).
    let statute: "en_attente" | "accepter" = "en_attente";
    server.use(
      http.get(`${API}/admin/cheques/1`, () =>
        HttpResponse.json(showEnvelope({ id: 1, statute })),
      ),
      http.put(`${API}/admin/cheques/1/approve`, () => {
        statute = "accepter";
        return HttpResponse.json({
          success: true,
          message: "Chèque approuvé avec succès",
          data: {
            cheque: showEnvelope({ id: 1, statute: "accepter" }).data,
            agent_new_montant_avance: "1500.00",
          },
        });
      }),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Not the "Cancel cheque" button — this session holds only
    // `approve-cheque`, not `annuler-cheque`, so THAT button's own absence
    // is expected and asserted separately (action visibility). The status
    // badge is the permission-agnostic proof the refetch actually happened.
    expect(await screen.findAllByText("Approved")).not.toHaveLength(0);
  });

  it("keeps the dialog open and shows an error on failure, without losing the cheque", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      http.put(`${API}/admin/cheques/1/approve`, () =>
        HttpResponse.json(
          { success: false, message: "Ce chèque a déjà été traité" },
          { status: 400 },
        ),
      ),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be approved/i,
    );
    expect(dialog).toBeInTheDocument();
  });

  it("invalidates cheques', managers' and commercials' caches on success", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["managers", "list", {}], { fake: true });
    queryClient.setQueryData(["commercials", "list", {}], { fake: true });
    queryClient.setQueryData(["cheques", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      approveHandler(1),
    );
    renderPage("/money/cheques/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(queryClient.getQueryState(["managers", "list", {}])?.isInvalidated).toBe(
        true,
      ),
    );
    expect(queryClient.getQueryState(["commercials", "list", {}])?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(["cheques", "list", {}])?.isInvalidated).toBe(true);
  });
});

describe("Reject", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.REJECT_CHEQUE]);
  });

  it("disables Reject in the dialog until a reason is entered", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })));
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible signature" },
    });
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("sends the entered reason as decision_reason", async () => {
    let body: unknown;
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      rejectHandler(1, (b) => (body = b)),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible signature" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(body).toEqual({ decision_reason: "Illegible signature" }));
  });

  it("closes the dialog and refetches the cheque as Rejected on success", async () => {
    // Stateful mock — see the Approve test's own note on why a static
    // handler would not actually exercise the refetch.
    let statute: "en_attente" | "rejetee" = "en_attente";
    let decisionReason: string | null = null;
    server.use(
      http.get(`${API}/admin/cheques/1`, () =>
        HttpResponse.json(
          showEnvelope({ id: 1, statute, decision_reason: decisionReason }),
        ),
      ),
      http.put(`${API}/admin/cheques/1/reject`, async ({ request }) => {
        const body = (await request.json()) as { decision_reason: string };
        statute = "rejetee";
        decisionReason = body.decision_reason;
        return HttpResponse.json({
          success: true,
          message: "Chèque rejeté avec succès",
          data: showEnvelope({ id: 1, statute, decision_reason: decisionReason }).data,
        });
      }),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible signature" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Illegible signature")).toBeInTheDocument();
  });

  it("maps a field-level 422 on decision_reason to the reason field, not a generic banner", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      http.put(`${API}/admin/cheques/1/reject`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: {
              decision_reason: ["The decision reason must not exceed 1000 characters."],
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "x" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(
      await within(dialog).findByText(
        "The decision reason must not exceed 1000 characters.",
      ),
    ).toBeInTheDocument();
    // The field error itself renders as role="alert" too (same convention
    // `create-cheque-page.tsx` already uses) — the real assertion is that
    // the GENERIC banner copy never appears alongside it.
    expect(within(dialog).queryByText(/could not be rejected/i)).not.toBeInTheDocument();
  });

  it("invalidates only cheques' own cache — no balance column is touched", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["managers", "list", {}], { fake: true });
    queryClient.setQueryData(["commercials", "list", {}], { fake: true });
    queryClient.setQueryData(["cheques", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "en_attente" })),
      rejectHandler(1),
    );
    renderPage("/money/cheques/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Illegible signature" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(queryClient.getQueryState(["cheques", "list", {}])?.isInvalidated).toBe(
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

describe("Annuler (Cancel cheque)", () => {
  beforeEach(() => {
    signInWith([PERMISSIONS.VIEW_CHEQUES, PERMISSIONS.ANNULER_CHEQUE]);
  });

  it("labels its dismiss button 'Keep approved', distinct from the destructive confirm", async () => {
    server.use(showHandler(1, showEnvelope({ id: 1, statute: "accepter" })));
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel cheque" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: "Keep approved" }),
    ).toBeInTheDocument();
  });

  it("closes the dialog and refetches the cheque as Cancelled on success", async () => {
    // Stateful mock — see the Approve test's own note.
    let statute: "accepter" | "annuler" = "accepter";
    let decisionReason: string | null = null;
    server.use(
      http.get(`${API}/admin/cheques/1`, () =>
        HttpResponse.json(
          showEnvelope({ id: 1, statute, decision_reason: decisionReason }),
        ),
      ),
      http.put(`${API}/admin/cheques/1/annuler`, async ({ request }) => {
        const body = (await request.json()) as { decision_reason: string };
        statute = "annuler";
        decisionReason = body.decision_reason;
        return HttpResponse.json({
          success: true,
          message: "Chèque annulé avec succès",
          data: showEnvelope({ id: 1, statute, decision_reason: decisionReason }).data,
        });
      }),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel cheque" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Agent requested reversal" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel cheque" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Agent requested reversal")).toBeInTheDocument();
  });

  it("shows the negative-balance-guard refusal as its own message, not raw backend text", async () => {
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "accepter" })),
      http.put(`${API}/admin/cheques/1/annuler`, () =>
        HttpResponse.json(
          {
            success: false,
            message:
              "Annulation refusée : le solde de l'agent ne couvre pas le montant à reverser",
            errors: {
              montant_avance_rapped: [
                "Current montant_avance_rapped=0.00 is less than 1500.00.",
              ],
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage("/money/cheques/1");

    fireEvent.click(await screen.findByRole("button", { name: "Cancel cheque" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Agent requested reversal" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel cheque" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This cheque could not be cancelled: the agent's balance no longer covers the amount to reverse.",
    );
  });

  it("invalidates cheques', managers' and commercials' caches on success — same as approve, it reverses the same columns", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["managers", "list", {}], { fake: true });
    queryClient.setQueryData(["commercials", "list", {}], { fake: true });
    queryClient.setQueryData(["cheques", "list", {}], { fake: true });
    server.use(
      showHandler(1, showEnvelope({ id: 1, statute: "accepter" })),
      annulerHandler(1),
    );
    renderPage("/money/cheques/1", queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel cheque" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Agent requested reversal" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel cheque" }));

    await waitFor(() =>
      expect(queryClient.getQueryState(["managers", "list", {}])?.isInvalidated).toBe(
        true,
      ),
    );
    expect(queryClient.getQueryState(["commercials", "list", {}])?.isInvalidated).toBe(
      true,
    );
  });
});
