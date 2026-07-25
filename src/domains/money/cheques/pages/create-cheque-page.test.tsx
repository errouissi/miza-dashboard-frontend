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
import { CreateChequePage } from "./create-cheque-page";

/**
 * Submission tests mock `httpClient.post` directly, NOT MSW — the same,
 * empirically-verified reason the M3.6 wizard's own submission tests do
 * (`agent-onboarding-wizard-page.test.tsx`'s own docblock): a `FormData`
 * containing a real `File` hangs indefinitely under this jsdom+MSW test
 * setup. Every non-submission test (rendering, validation, the merged
 * agent picker) posts nothing and is unaffected, so those keep using real
 * MSW handlers.
 */

const API = "http://localhost/api/v1";
const PATH = "/money/cheques/new";
const CHEQUES_PATH = "/money/cheques";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const ALL_CREATE_CHEQUE_PERMISSIONS = [
  PERMISSIONS.CREATE_CHEQUE,
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

/** `store()`'s own response shape — verified DIFFERENT from index()/show()'s: `photo_url` sits beside `cheque`, not spread into it. */
const CREATE_CHEQUE_ENVELOPE = {
  success: true,
  message: "Chèque soumis avec succès",
  data: {
    cheque: {
      id: 501,
      amount: "1500.00",
      num_cheque: "CHQ-9001",
      photo_cheque: "agents/10/cheques/cheque_CHQ-9001_20260725.jpg",
      agent_id: 10,
      statute: "en_attente",
      decision_reason: null,
      processed_by: null,
      processed_at: null,
      created_at: "2026-07-25T10:00:00.000000Z",
      updated_at: "2026-07-25T10:00:00.000000Z",
      agent: { id: 10, nom: "Idrissi", prenom: "Youssef" },
    },
    photo_url: "http://localhost/storage/agents/10/cheques/cheque_CHQ-9001_20260725.jpg",
  },
};

const validImage = (name = "cheque.jpg") => new File(["x"], name, { type: "image/jpeg" });

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateChequePage /> },
      { path: CHEQUES_PATH, element: <p>Cheques list</p> },
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
  const agentSelect = await screen.findByRole("combobox", { name: /agent/i });
  await within(agentSelect).findByRole("option", { name: "Youssef Idrissi" });
  fireEvent.change(agentSelect, { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "1500" } });
  fireEvent.change(screen.getByLabelText(/cheque number/i), {
    target: { value: "CHQ-9001" },
  });
  fireEvent.change(screen.getByLabelText("Cheque photo"), {
    target: { files: [validImage()] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith(ALL_CREATE_CHEQUE_PERMISSIONS);
});

describe("rendering", () => {
  it("renders exactly the four backend-supported fields, no Bank or Issue Date", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByRole("combobox", { name: /agent/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cheque number/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Cheque photo")).toBeInTheDocument();
    // No field exists for a capability the backend does not have (ADR-0009).
    expect(screen.queryByLabelText(/bank/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/issue date/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Cheque" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("validation", () => {
  it("shows a required error for every field on an empty submit", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(await screen.findByText("Agent is required.")).toBeInTheDocument();
    expect(screen.getByText("Amount is required.")).toBeInTheDocument();
    expect(screen.getByText("Cheque number is required.")).toBeInTheDocument();
    expect(screen.getByText("Cheque photo is required.")).toBeInTheDocument();
  });

  it("rejects a non-numeric amount", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(await screen.findByText("Enter a valid number.")).toBeInTheDocument();
  });

  it("rejects an amount below 0.01", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(await screen.findByText("Amount must be at least 0.01.")).toBeInTheDocument();
  });

  it("rejects a cheque number with characters outside the backend's own regex", async () => {
    server.use(managersHandler(), commercialsHandler());
    renderPage();
    await fillValidForm();

    fireEvent.change(screen.getByLabelText(/cheque number/i), {
      target: { value: "CHQ 001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(
      await screen.findByText(
        "Only letters, numbers, hyphens and underscores are allowed.",
      ),
    ).toBeInTheDocument();
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

  it("gates the Commercials half on view-agents, still queries Managers unconditionally", async () => {
    signInWith([PERMISSIONS.CREATE_CHEQUE]);
    let managersRequested = false;
    server.use(
      http.get(`${API}/admin/agents/managers`, () => {
        managersRequested = true;
        return HttpResponse.json({
          success: true,
          data: { data: [], current_page: 1, per_page: 100, total: 0, last_page: 1 },
        });
      }),
      // No commercials handler: MSW's onUnhandledRequest:"error" fails this
      // test if the Commercial half fires anyway — the assertion itself.
    );
    renderPage();

    await waitFor(() => expect(managersRequested).toBe(true));
  });
});

describe("submission — FormData payload and success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a multipart request with the exact wire field names", async () => {
    const postSpy = vi
      .spyOn(httpClient, "post")
      .mockResolvedValue({ data: CREATE_CHEQUE_ENVELOPE });
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, body] = postSpy.mock.calls[0] as [string, FormData];
    expect(url).toBe("/admin/cheques");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("agent_id")).toBe("10");
    expect(body.get("amount")).toBe("1500");
    expect(body.get("num_cheque")).toBe("CHQ-9001");
    expect(body.get("photo_cheque")).toBeInstanceOf(File);
  });

  it("shows the pending label and disables the button while the request is in flight", async () => {
    let resolvePost:
      ((value: { data: typeof CREATE_CHEQUE_ENVELOPE }) => void) | undefined;
    vi.spyOn(httpClient, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(await screen.findByRole("button", { name: "Creating…" })).toBeDisabled();
    resolvePost?.({ data: CREATE_CHEQUE_ENVELOPE });
  });

  it("navigates to the Cheques list on success", async () => {
    vi.spyOn(httpClient, "post").mockResolvedValue({ data: CREATE_CHEQUE_ENVELOPE });
    server.use(managersHandler(), commercialsHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(CHEQUES_PATH));
  });
});

describe("Cancel", () => {
  it("navigates to the Cheques list without submitting", async () => {
    const postSpy = vi.spyOn(httpClient, "post");
    server.use(managersHandler(), commercialsHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(CHEQUES_PATH);
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
    server.use(managersHandler(), commercialsHandler());
    const router = renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(
      await screen.findByText(/something went wrong creating this cheque/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText(/amount/i)).toHaveValue("1500");
    expect(screen.getByLabelText(/cheque number/i)).toHaveValue("CHQ-9001");
  });

  it("maps a field-level 422 (e.g. a duplicate cheque number) to its own field, not a generic banner", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({
        kind: "validation",
        status: 422,
        message: "Erreur de validation",
        fieldErrors: { num_cheque: ["The num cheque has already been taken."] },
      }),
    );
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(
      await screen.findByText("The num cheque has already been taken."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/something went wrong creating this cheque/i),
    ).not.toBeInTheDocument();
  });

  it("shows a permission-specific message on a 403", async () => {
    vi.spyOn(httpClient, "post").mockRejectedValue(
      new AppError({ kind: "permission", status: 403, message: "Forbidden" }),
    );
    server.use(managersHandler(), commercialsHandler());
    renderPage();

    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Cheque" }));

    expect(
      await screen.findByText(/you do not have permission to create a cheque/i),
    ).toBeInTheDocument();
  });
});
