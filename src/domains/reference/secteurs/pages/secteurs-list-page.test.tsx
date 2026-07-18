import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { SecteursListPage } from "./secteurs-list-page";

const API = "http://localhost/api/v1";
const PATH = "/reference/secteurs";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

const VILLES = [
  { id: 1, nom_ville: "Casablanca" },
  { id: 2, nom_ville: "Rabat" },
];

/** The villes picker source — a PAGINATED envelope, unlike secteurs. */
function villesHandler(onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/villes`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json({
      data: VILLES,
      links: {},
      meta: {
        current_page: 1,
        per_page: 100,
        total: VILLES.length,
        last_page: 1,
      },
    });
  });
}

/** Secteurs is a RAW ARRAY — no envelope, no meta. */
function secteursHandler(
  rows: Array<{ id: number; nom_secteur: string; ville_id: number }>,
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/secteurs`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(rows);
  });
}

function renderPage(initialPath = PATH) {
  const router = createMemoryRouter([{ path: PATH, element: <SecteursListPage /> }], {
    initialEntries: [initialPath],
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
  sessionManager.start({
    token: "tok",
    user: { ...baseUser, permissions: [PERMISSIONS.ACCESS_DASHBOARD] },
  });
});

describe("secteurs list — raw-array contract", () => {
  it("renders rows from an unenveloped array", async () => {
    server.use(
      villesHandler(),
      secteursHandler([
        { id: 10, nom_secteur: "Maarif", ville_id: 1 },
        { id: 11, nom_secteur: "Agdal", ville_id: 2 },
      ]),
    );
    renderPage();

    expect(await screen.findByText("Maarif")).toBeInTheDocument();
    expect(screen.getByText("Agdal")).toBeInTheDocument();
  });

  it("sends NO pagination, search or sort parameters", async () => {
    // The endpoint accepts none of them. Sending them would imply a contract the
    // server does not honour and would silently mask BC-G.
    let url: URL | undefined;
    server.use(
      villesHandler(),
      secteursHandler([], (u) => (url = u)),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());

    expect(url?.searchParams.has("page")).toBe(false);
    expect(url?.searchParams.has("per_page")).toBe(false);
    expect(url?.searchParams.has("search")).toBe(false);
    expect(url?.searchParams.has("sort")).toBe(false);
    expect(url?.searchParams.has("direction")).toBe(false);
    expect(url?.searchParams.has("ville_id")).toBe(false);
  });

  it("renders no search box, no sortable header and no pager", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    renderPage();

    await screen.findByText("Maarif");

    expect(screen.queryByLabelText(/search/i)).not.toBeInTheDocument();
    // "Name" must be plain text, not a sort control.
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(villesHandler(), secteursHandler([]));
    renderPage();

    expect(await screen.findByText(/no sector yet/i)).toBeInTheDocument();
  });

  it("shows a distinct empty state when a city filter is applied", async () => {
    server.use(villesHandler(), secteursHandler([]));
    renderPage(`${PATH}?ville_id=1`);

    expect(await screen.findByText(/no sector in this city/i)).toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      villesHandler(),
      http.get(`${API}/admin/secteurs`, ({ request }) => {
        sentRequestId = request.headers.get("X-Request-Id");
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(sentRequestId).toBeTruthy());

    expect(within(alert).getByText(`Ref. ${sentRequestId}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("recovers on manual retry", async () => {
    let shouldFail = true;
    server.use(
      villesHandler(),
      http.get(`${API}/admin/secteurs`, () =>
        shouldFail
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
      ),
    );
    renderPage();

    await screen.findByRole("alert");
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Maarif")).toBeInTheDocument();
  });
});

describe("ville filter — the one filter the API supports", () => {
  it("reads the filter from the URL and forwards it", async () => {
    let url: URL | undefined;
    server.use(
      villesHandler(),
      secteursHandler([], (u) => (url = u)),
    );
    renderPage(`${PATH}?ville_id=2`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("ville_id")).toBe("2");
  });

  it("writes the filter into the URL when changed", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    const router = renderPage();

    await screen.findByText("Maarif");
    fireEvent.change(screen.getByLabelText(/filter by city/i), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(router.state.location.search).toBe("?ville_id=2");
    });
  });

  it("clears the filter out of the URL entirely", async () => {
    server.use(villesHandler(), secteursHandler([]));
    const router = renderPage(`${PATH}?ville_id=2`);

    await screen.findByLabelText(/filter by city/i);
    fireEvent.change(screen.getByLabelText(/filter by city/i), {
      target: { value: "" },
    });

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("IGNORES a hostile filter value rather than forwarding it", async () => {
    let url: URL | undefined;
    server.use(
      villesHandler(),
      secteursHandler([], (u) => (url = u)),
    );
    renderPage(`${PATH}?ville_id=not-a-number`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.has("ville_id")).toBe(false);
  });
});

describe("ville relation", () => {
  it("resolves the ville name through the Villes public surface", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    renderPage();

    const row = (await screen.findByText("Maarif")).closest("tr");
    expect(within(row!).getByText("Casablanca")).toBeInTheDocument();
  });

  it("renders the absent marker for a ville outside the picker set", async () => {
    // A secteur whose ville is beyond the options page (per_page bound) must not
    // render a bare foreign key.
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Orphan", ville_id: 999 }]),
    );
    renderPage();

    const row = (await screen.findByText("Orphan")).closest("tr");
    expect(within(row!).getByText("—")).toBeInTheDocument();
    expect(within(row!).queryByText("999")).not.toBeInTheDocument();
  });

  it("requests villes ONCE for both the filter and the relation column", async () => {
    // The single-source rule: one ville read serves the filter select, the form
    // picker and every row's name. A second fetch would mean a second cache.
    let villeRequests = 0;
    server.use(
      villesHandler(() => {
        villeRequests += 1;
      }),
      secteursHandler([
        { id: 10, nom_secteur: "Maarif", ville_id: 1 },
        { id: 11, nom_secteur: "Agdal", ville_id: 2 },
      ]),
    );
    renderPage();

    await screen.findByText("Maarif");
    await waitFor(() => expect(villeRequests).toBe(1));
  });

  it("requests the picker set within the backend's per_page maximum", async () => {
    let url: URL | undefined;
    server.use(
      villesHandler((u) => (url = u)),
      secteursHandler([]),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    // IndexVilleRequest caps per_page at 100; asking for more is a 422.
    expect(Number(url?.searchParams.get("per_page"))).toBeLessThanOrEqual(100);
  });
});

describe("permission-gated actions", () => {
  it("renders create/edit/delete for a permitted session", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    renderPage();

    await screen.findByText("Maarif");
    expect(screen.getByRole("button", { name: /new sector/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit maarif/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete maarif/i })).toBeInTheDocument();
  });

  it("renders NO action controls without the permission", async () => {
    sessionManager.__resetForTests();
    sessionManager.start({ token: "tok", user: { ...baseUser, permissions: [] } });

    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    renderPage();

    await screen.findByText("Maarif");
    expect(screen.queryByRole("button", { name: /new sector/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit maarif/i }),
    ).not.toBeInTheDocument();
  });
});

describe("create / edit / delete", () => {
  it("creates a sector with its ville, from the raw 201 envelope", async () => {
    let created: unknown;
    server.use(
      villesHandler(),
      secteursHandler([]),
      http.post(`${API}/admin/secteurs`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(
          { id: 12, nom_secteur: "Gauthier", ville_id: 1 },
          { status: 201 },
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new sector/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Gauthier" },
    });
    fireEvent.change(within(dialog).getByLabelText(/city/i), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(created).toEqual({ nom_secteur: "Gauthier", ville_id: 1 }),
    );
  });

  it("populates the ville picker from the Villes public surface", async () => {
    server.use(villesHandler(), secteursHandler([]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new sector/i }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("option", { name: "Casablanca" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Rabat" })).toBeInTheDocument();
  });

  it("refuses to submit without a city", async () => {
    let posted = false;
    server.use(
      villesHandler(),
      secteursHandler([]),
      http.post(`${API}/admin/secteurs`, () => {
        posted = true;
        return HttpResponse.json(
          { id: 12, nom_secteur: "X", ville_id: 1 },
          { status: 201 },
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new sector/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "X" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/city is required/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("maps the composite-unique 422 onto the name field", async () => {
    // Uniqueness is nom_secteur PER ville_id, but Laravel reports it against
    // nom_secteur — so it must land on the name field, not the city field.
    server.use(
      villesHandler(),
      secteursHandler([]),
      http.post(`${API}/admin/secteurs`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { nom_secteur: ["The nom secteur has already been taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new sector/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Maarif" },
    });
    fireEvent.change(within(dialog).getByLabelText(/city/i), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/already been taken/i)).toBeInTheDocument();
  });

  it("seeds the edit drawer with the row's name AND ville", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 2 }]),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit maarif/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Maarif");
    expect(within(dialog).getByLabelText(/city/i)).toHaveValue("2");
  });

  it("sends the update through the wrapped envelope, resending ville_id", async () => {
    let updated: unknown;
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
      http.put(`${API}/admin/secteurs/10`, async ({ request }) => {
        updated = await request.json();
        return HttpResponse.json({
          status: "success",
          message: "Secteur updated successfully",
          data: { id: 10, nom_secteur: "Maarif Nord", ville_id: 1 },
        });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit maarif/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Maarif Nord" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    // ville_id is `required` on update too — it must be resent even unchanged.
    await waitFor(() =>
      expect(updated).toEqual({ nom_secteur: "Maarif Nord", ville_id: 1 }),
    );
  });

  it("names the sector in the delete confirmation", async () => {
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete maarif/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/maarif/i)).toBeInTheDocument();
  });

  it("deletes on confirmation", async () => {
    let deleted = false;
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
      http.delete(`${API}/admin/secteurs/10`, () => {
        deleted = true;
        return HttpResponse.json({ message: "Secteur deleted" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete maarif/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("surfaces a failed delete without closing the confirmation", async () => {
    // No in-use guard server-side, so an FK violation arrives as a 500 (BC-I).
    server.use(
      villesHandler(),
      secteursHandler([{ id: 10, nom_secteur: "Maarif", ville_id: 1 }]),
      http.delete(`${API}/admin/secteurs/10`, () =>
        HttpResponse.json({ message: "Server Error" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete maarif/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be deleted/i,
    );
  });
});
