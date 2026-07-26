import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { CreateAgentTransferPage } from "./create-agent-transfer-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/agent-transfers/new";
const TRANSFERS_PATH = "/stock/agent-transfers";
const DETAIL_PATH = "/stock/agent-transfers/:id";

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

function managersHandler() {
  return http.get(`${API}/admin/agents/managers`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [{ id: 20, nom: "Bennani", prenom: "Youssef", status: "active" }],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

/** `AgentController::getAgentSubData`'s own MANAGER-branch envelope. */
function subDataHandler(
  managerId: number,
  commercials: { id: number; nom: string; prenom: string; status: string }[],
) {
  return http.get(`${API}/admin/agents/${managerId}/sub-data`, () =>
    HttpResponse.json({
      success: true,
      agent_selected: "manager: Youssef Bennani",
      type: "commercials",
      data: {
        data: commercials,
        current_page: 1,
        per_page: 100,
        total: commercials.length,
        last_page: 1,
      },
    }),
  );
}

/** `store()`'s own flat envelope — `{"data": new AgentTransferResource(...)}`. */
const CREATE_TRANSFER_ENVELOPE = {
  data: {
    id: 900,
    transfer_number: "TRF-900",
    status: "draft",
    montant: "0.00",
    notes: null,
    transfer_date: null,
    admin_id: 1,
    manager_id: 20,
    commercial_id: 10,
    approved_by: null,
    approved_at: null,
    created_at: "2026-07-25T09:00:00Z",
    updated_at: "2026-07-25T09:00:00Z",
    creator: { id: 1, name: "Ahmed Errouissi" },
    manager: { id: 20, nom: "Bennani", prenom: "Youssef" },
    commercial: { id: 10, nom: "Alaoui", prenom: "Sara" },
  },
};

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateAgentTransferPage /> },
      { path: TRANSFERS_PATH, element: <p>Agent Transfers list</p> },
      { path: DETAIL_PATH, element: <p>Transfer detail</p> },
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

async function selectManagerAndCommercial() {
  const managerSelect = await screen.findByLabelText("Manager");
  await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
  fireEvent.change(managerSelect, { target: { value: "20" } });

  const commercialSelect = await screen.findByLabelText("Commercial");
  await within(commercialSelect).findByRole("option", { name: "Sara Alaoui" });
  fireEvent.change(commercialSelect, { target: { value: "10" } });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.CREATE_AGENT_TRANSFER, PERMISSIONS.VIEW_AGENTS]);
});

describe("rendering", () => {
  it("renders the backend-supported fields", async () => {
    server.use(managersHandler());
    renderPage();

    expect(await screen.findByLabelText("Transfer number")).toBeInTheDocument();
    expect(screen.getByLabelText("Manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Commercial")).toBeInTheDocument();
    expect(screen.getByLabelText("Transfer date")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Transfer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("disables the Commercial select until a manager is chosen", async () => {
    server.use(managersHandler());
    renderPage();

    expect(await screen.findByLabelText("Commercial")).toBeDisabled();
  });
});

describe("manager -> commercial cascade", () => {
  it("populates Commercial options scoped to the selected manager", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
    );
    renderPage();

    const managerSelect = await screen.findByLabelText("Manager");
    await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
    fireEvent.change(managerSelect, { target: { value: "20" } });

    const commercialSelect = await screen.findByLabelText("Commercial");
    await waitFor(() => expect(commercialSelect).toBeEnabled());
    expect(
      await within(commercialSelect).findByRole("option", { name: "Sara Alaoui" }),
    ).toBeInTheDocument();
  });

  it("excludes non-active commercials from the options", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [
        { id: 10, nom: "Alaoui", prenom: "Sara", status: "active" },
        { id: 11, nom: "Idrissi", prenom: "Karim", status: "blocked" },
      ]),
    );
    renderPage();

    const managerSelect = await screen.findByLabelText("Manager");
    await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
    fireEvent.change(managerSelect, { target: { value: "20" } });
    const commercialSelect = await screen.findByLabelText("Commercial");

    await within(commercialSelect).findByRole("option", { name: "Sara Alaoui" });
    expect(
      within(commercialSelect).queryByRole("option", { name: "Karim Idrissi" }),
    ).not.toBeInTheDocument();
  });

  it("clears the selected commercial when the manager changes", async () => {
    server.use(
      managersHandler(),
      http.get(`${API}/admin/agents/managers`, () =>
        HttpResponse.json({
          success: true,
          data: {
            data: [
              { id: 20, nom: "Bennani", prenom: "Youssef", status: "active" },
              { id: 21, nom: "Tazi", prenom: "Nadia", status: "active" },
            ],
            current_page: 1,
            per_page: 100,
            total: 2,
            last_page: 1,
          },
        }),
      ),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      subDataHandler(21, [{ id: 12, nom: "Fassi", prenom: "Omar", status: "active" }]),
    );
    renderPage();

    await selectManagerAndCommercial();
    expect(screen.getByLabelText("Commercial")).toHaveValue("10");

    fireEvent.change(screen.getByLabelText("Manager"), { target: { value: "21" } });

    expect(screen.getByLabelText("Commercial")).toHaveValue("");
  });
});

describe("validation", () => {
  it("shows a required error for every field on an empty submit", async () => {
    server.use(managersHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Transfer" }));

    expect(await screen.findByText("Transfer number is required.")).toBeInTheDocument();
    expect(screen.getByText("Manager is required.")).toBeInTheDocument();
    expect(screen.getByText("Commercial is required.")).toBeInTheDocument();
  });
});

describe("submission and success", () => {
  it("submits the exact wire field names, omitting blank optional fields", async () => {
    let body: unknown;
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(CREATE_TRANSFER_ENVELOPE, { status: 201 });
      }),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    await waitFor(() =>
      expect(body).toEqual({
        transfer_number: "TRF-900",
        manager_id: "20",
        commercial_id: "10",
      }),
    );
  });

  it("includes notes and transfer_date only when filled in", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CREATE_TRANSFER_ENVELOPE, { status: 201 });
      }),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Restocking" },
    });
    fireEvent.change(screen.getByLabelText("Transfer date"), {
      target: { value: "2026-07-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    await waitFor(() => expect(body.notes).toBe("Restocking"));
    expect(body.transfer_date).toBe("2026-07-25");
  });

  it("navigates to the new transfer's own detail page on success", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, () =>
        HttpResponse.json(CREATE_TRANSFER_ENVELOPE, { status: 201 }),
      ),
    );
    const router = renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/stock/agent-transfers/900"),
    );
  });
});

describe("Cancel", () => {
  it("navigates to the list without submitting", async () => {
    let called = false;
    server.use(
      managersHandler(),
      http.post(`${API}/admin/agent-transfers`, () => {
        called = true;
        return HttpResponse.json(CREATE_TRANSFER_ENVELOPE, { status: 201 });
      }),
    );
    const router = renderPage();

    await screen.findByLabelText("Transfer number");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(TRANSFERS_PATH);
    expect(called).toBe(false);
  });
});

describe("failure preserves entered values", () => {
  it("shows a general error and does not navigate on a server failure", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, () =>
        HttpResponse.json({ message: "Server error" }, { status: 500 }),
      ),
    );
    const router = renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    expect(
      await screen.findByText(/something went wrong recording this transfer/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText("Transfer number")).toHaveValue("TRF-900");
  });

  it("maps a field-level 422 (e.g. a duplicate transfer number) to its own field", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { transfer_number: ["The transfer number has already been taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    expect(
      await screen.findByText("The transfer number has already been taken."),
    ).toBeInTheDocument();
  });

  it("shows a permission-specific message on a 403", async () => {
    server.use(
      managersHandler(),
      subDataHandler(20, [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }]),
      http.post(`${API}/admin/agent-transfers`, () =>
        HttpResponse.json(
          { success: false, code: "AUTHORIZATION_DENIED" },
          { status: 403 },
        ),
      ),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText("Transfer number"), {
      target: { value: "TRF-900" },
    });
    await selectManagerAndCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Record Transfer" }));

    expect(
      await screen.findByText(/you do not have permission to record a transfer/i),
    ).toBeInTheDocument();
  });
});
