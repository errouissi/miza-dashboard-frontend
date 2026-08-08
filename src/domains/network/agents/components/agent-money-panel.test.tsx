import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentMoneyPanel } from "./agent-money-panel";

const API = "http://localhost/api/v1";

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

function depositsEnvelope(rows: unknown[] = []) {
  return {
    data: rows,
    meta: { current_page: 1, per_page: 15, total: rows.length, last_page: 1 },
  };
}

function depositRow(id: number) {
  return {
    id,
    amount: 1500,
    status: "pending",
    type: "rapped",
    method: "cash",
    receipt: null,
    proof_url: null,
    date: "2026-08-01 10:00",
    agent: { id: 5, full_name: "Youssef Idrissi", account_number: "MG0005", photo: null },
    created_by: "System",
    reject_reason: null,
    validated_by: null,
    validated_at: null,
    bank_name: null,
    proof_type: "bank_receipt",
  };
}

function chequesEnvelope(rows: unknown[] = []) {
  return {
    success: true,
    data: { data: rows, current_page: 1, per_page: 15, total: rows.length, last_page: 1 },
  };
}

function chequeRow(id: number) {
  return {
    id,
    amount: "2000.00",
    num_cheque: `CHQ-${id}`,
    agent_id: 5,
    decision_reason: null,
    processed_at: null,
    created_at: "2026-08-02T09:00:00.000000Z",
    statute: "pending",
    photo_url: null,
    agent: { id: 5, nom: "Idrissi", prenom: "Youssef" },
  };
}

function depositsHandler(rows: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/depos`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(depositsEnvelope(rows));
  });
}

function chequesHandler(rows: unknown[] = [], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/cheques`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(chequesEnvelope(rows));
  });
}

function renderPanel(agentId = 5) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={createQueryClient()}>
        <AgentMoneyPanel agentId={agentId} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.VIEW_DEPOSITS, PERMISSIONS.VIEW_CHEQUES]);
});

describe("permission gating — independent, and no unauthorized query", () => {
  it("mounts neither query, and renders nothing, without either permission", () => {
    signInWith([]);
    let depositsRequested = false;
    let chequesRequested = false;
    server.use(
      depositsHandler([], () => (depositsRequested = true)),
      chequesHandler([], () => (chequesRequested = true)),
    );
    renderPanel();

    expect(screen.queryByText("Money")).not.toBeInTheDocument();
    expect(depositsRequested).toBe(false);
    expect(chequesRequested).toBe(false);
  });

  it("shows only Deposits, and never requests Cheques, with view-depos alone", async () => {
    signInWith([PERMISSIONS.VIEW_DEPOSITS]);
    let chequesRequested = false;
    server.use(
      depositsHandler([depositRow(1)]),
      chequesHandler([], () => (chequesRequested = true)),
    );
    renderPanel();

    expect(await screen.findByText("Recent deposits")).toBeInTheDocument();
    expect(screen.queryByText("Recent cheques")).not.toBeInTheDocument();
    expect(chequesRequested).toBe(false);
  });

  it("shows only Cheques, and never requests Deposits, with view-cheques alone", async () => {
    signInWith([PERMISSIONS.VIEW_CHEQUES]);
    let depositsRequested = false;
    server.use(
      depositsHandler([], () => (depositsRequested = true)),
      chequesHandler([chequeRow(1)]),
    );
    renderPanel();

    expect(await screen.findByText("Recent cheques")).toBeInTheDocument();
    expect(screen.queryByText("Recent deposits")).not.toBeInTheDocument();
    expect(depositsRequested).toBe(false);
  });

  it("shows both when both permissions are held", async () => {
    server.use(depositsHandler([depositRow(1)]), chequesHandler([chequeRow(1)]));
    renderPanel();

    expect(await screen.findByText("Recent deposits")).toBeInTheDocument();
    expect(screen.getByText("Recent cheques")).toBeInTheDocument();
  });
});

describe("exact backend filter parameters", () => {
  it("filters deposits by the exact agent_id", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([], (u) => (url = u)),
      chequesHandler([]),
    );
    renderPanel(5);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("agent_id")).toBe("5");
  });

  it("filters cheques by the exact agent_id", async () => {
    let url: URL | undefined;
    server.use(
      depositsHandler([]),
      chequesHandler([], (u) => (url = u)),
    );
    renderPanel(5);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("agent_id")).toBe("5");
  });
});

describe("rendering, loading, empty and error states", () => {
  it("shows up to 5 rows even when the backend returns more", async () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map(depositRow);
    server.use(depositsHandler(rows), chequesHandler([]));
    renderPanel();

    // Wait for actual rows, not just the heading — the heading renders
    // immediately while the query is still pending (skeleton state).
    await screen.findAllByRole("listitem");
    const list = screen.getByText("Recent deposits").closest("div")!.parentElement!;
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows an empty message when there are no deposits", async () => {
    server.use(depositsHandler([]), chequesHandler([]));
    renderPanel();

    expect(
      await screen.findByText(/no deposits yet for this agent/i),
    ).toBeInTheDocument();
  });

  it("shows a retryable error and recovers", async () => {
    let shouldFail = true;
    server.use(
      http.get(`${API}/admin/depos`, () =>
        shouldFail
          ? HttpResponse.json({ success: false, message: "boom" }, { status: 500 })
          : HttpResponse.json(depositsEnvelope([depositRow(1)])),
      ),
      chequesHandler([]),
    );
    renderPanel();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(/no cheques/i)).toBeInTheDocument(); // cheques empty renders alongside
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a filtered View all link for each sub-section", async () => {
    server.use(depositsHandler([depositRow(1)]), chequesHandler([chequeRow(1)]));
    renderPanel(5);

    await screen.findByText("Recent deposits");
    const links = screen.getAllByRole("link", { name: "View all" });
    expect(links[0]).toHaveAttribute("href", "/money/deposits?agent_id=5");
    expect(links[1]).toHaveAttribute("href", "/money/cheques?agent_id=5");
  });

  it("never renders a raw Agent financial/balance fact anywhere in this panel", async () => {
    server.use(depositsHandler([depositRow(1)]), chequesHandler([chequeRow(1)]));
    renderPanel();

    await screen.findByText("Recent deposits");
    // No label this panel could plausibly use for a raw balance/capacity fact.
    for (const forbidden of [/balance/i, /capacity/i, /exposure/i, /solde/i, /avance/i]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });
});
