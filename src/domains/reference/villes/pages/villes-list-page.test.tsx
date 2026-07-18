import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { VillesListPage } from "./villes-list-page";

const API = "http://localhost/api/v1";
const PATH = "/reference/villes";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

function page(rows: Array<{ id: number; nom_ville: string }>, meta = {}) {
  return {
    data: rows,
    links: {},
    meta: {
      current_page: 1,
      per_page: 15,
      total: rows.length,
      last_page: 1,
      ...meta,
    },
  };
}

/** Captures the query string the frontend actually sent — the contract under test. */
function listHandler(
  rows: Array<{ id: number; nom_ville: string }>,
  onRequest?: (url: URL) => void,
  meta = {},
) {
  return http.get(`${API}/admin/villes`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(page(rows, meta));
  });
}

function renderPage(initialPath = PATH) {
  const router = createMemoryRouter([{ path: PATH, element: <VillesListPage /> }], {
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

describe("villes list", () => {
  it("renders the rows the backend returned", async () => {
    server.use(
      listHandler([
        { id: 1, nom_ville: "Casablanca" },
        { id: 2, nom_ville: "Rabat" },
      ]),
    );
    renderPage();

    expect(await screen.findByText("Casablanca")).toBeInTheDocument();
    expect(screen.getByText("Rabat")).toBeInTheDocument();
  });

  it("sends the documented default query surface", async () => {
    let url: URL | undefined;
    server.use(listHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());

    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("per_page")).toBe("15");
    // nom_ville ASC, NOT created_at DESC — villes has no timestamps.
    expect(url?.searchParams.get("sort")).toBe("nom_ville");
    expect(url?.searchParams.get("direction")).toBe("asc");
    // An empty search is omitted rather than sent blank.
    expect(url?.searchParams.has("search")).toBe(false);
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(listHandler([]));
    renderPage();

    expect(await screen.findByText(/no city yet/i)).toBeInTheDocument();
  });

  it("shows a retryable error state when the list fails", async () => {
    server.use(
      http.get(`${API}/admin/villes`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("filter state lives in the URL", () => {
  it("reads the filters out of the query string on first render", async () => {
    let url: URL | undefined;
    server.use(listHandler([], (u) => (url = u)));

    // A pasted link must reproduce the same view (Design System §15).
    renderPage(`${PATH}?search=casa&sort=id&direction=desc&page=3&per_page=50`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("search")).toBe("casa");
    expect(url?.searchParams.get("sort")).toBe("id");
    expect(url?.searchParams.get("direction")).toBe("desc");
    expect(url?.searchParams.get("page")).toBe("3");
    expect(url?.searchParams.get("per_page")).toBe("50");
  });

  it("writes the search into the URL and resets to page 1", async () => {
    server.use(listHandler([]));
    const router = renderPage(`${PATH}?page=4`);

    await screen.findByLabelText(/search cities/i);
    fireEvent.change(screen.getByLabelText(/search cities/i), {
      target: { value: "casa" },
    });

    await waitFor(() => {
      expect(router.state.location.search).toContain("search=casa");
    });
    // The old page number refers to a result set that no longer exists.
    expect(router.state.location.search).not.toContain("page=4");
  });

  it("keeps defaults out of the URL", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    const router = renderPage(`${PATH}?search=casa`);

    await screen.findByText("Casablanca");
    fireEvent.change(screen.getByLabelText(/search cities/i), { target: { value: "" } });

    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
  });

  it("toggles sort direction and records it in the URL", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    const router = renderPage();

    await screen.findByText("Casablanca");
    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    await waitFor(() => {
      expect(router.state.location.search).toContain("direction=desc");
    });
  });

  it("IGNORES out-of-contract URL values rather than forwarding them", async () => {
    let url: URL | undefined;
    server.use(listHandler([], (u) => (url = u)));

    // The query string is user-controlled. per_page=9999 is a 422 server-side and
    // sort=password is not in IndexVilleRequest's enum — neither leaves the page.
    renderPage(`${PATH}?per_page=9999&sort=password&direction=sideways&page=-2`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("per_page")).toBe("15");
    expect(url?.searchParams.get("sort")).toBe("nom_ville");
    expect(url?.searchParams.get("direction")).toBe("asc");
    expect(url?.searchParams.get("page")).toBe("1");
  });
});

describe("pagination", () => {
  it("moves to the next page and records it in the URL", async () => {
    server.use(
      listHandler([{ id: 1, nom_ville: "Casablanca" }], undefined, {
        total: 30,
        last_page: 2,
      }),
    );
    const router = renderPage();

    await screen.findByText("Casablanca");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(router.state.location.search).toContain("page=2");
    });
  });

  it("hides pagination when there is a single page", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    renderPage();

    await screen.findByText("Casablanca");
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});

describe("permission-gated actions", () => {
  it("renders create/edit/delete for a permitted session", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    renderPage();

    await screen.findByText("Casablanca");
    expect(screen.getByRole("button", { name: /new city/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit casablanca/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete casablanca/i }),
    ).toBeInTheDocument();
  });

  it("renders NO action controls without the permission", async () => {
    // Absent, not disabled: "you lack the permission" is not an explanation an
    // operator can act on (Design System §10).
    sessionManager.__resetForTests();
    sessionManager.start({ token: "tok", user: { ...baseUser, permissions: [] } });

    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    renderPage();

    await screen.findByText("Casablanca");
    expect(screen.queryByRole("button", { name: /new city/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit casablanca/i }),
    ).not.toBeInTheDocument();
  });
});

describe("create / edit / delete", () => {
  it("creates a city and refreshes the list", async () => {
    let created: unknown;
    server.use(
      listHandler([]),
      http.post(`${API}/admin/villes`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ id: 9, nom_ville: "Fès" }, { status: 201 });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new city/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Fès" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(created).toEqual({ nom_ville: "Fès" }));
  });

  it("maps a duplicate-name 422 onto the field", async () => {
    server.use(
      listHandler([]),
      http.post(`${API}/admin/villes`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { nom_ville: ["The nom ville has already been taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /new city/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Casablanca" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/already been taken/i)).toBeInTheDocument();
  });

  it("seeds the edit drawer with the row being edited", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit casablanca/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Casablanca");
  });

  it("sends the update through the wrapped-envelope endpoint", async () => {
    let updated: unknown;
    server.use(
      listHandler([{ id: 1, nom_ville: "Casablanca" }]),
      http.put(`${API}/admin/villes/1`, async ({ request }) => {
        updated = await request.json();
        return HttpResponse.json({
          status: "success",
          message: "Ville updated successfully",
          data: { id: 1, nom_ville: "Casa" },
        });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit casablanca/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Casa" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updated).toEqual({ nom_ville: "Casa" }));
  });

  it("names the city in the delete confirmation", async () => {
    server.use(listHandler([{ id: 1, nom_ville: "Casablanca" }]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete casablanca/i }));

    const dialog = await screen.findByRole("dialog");
    // Confirming something you cannot verify is how the wrong row gets deleted.
    expect(within(dialog).getByText(/casablanca/i)).toBeInTheDocument();
  });

  it("deletes on confirmation", async () => {
    let deleted = false;
    server.use(
      listHandler([{ id: 1, nom_ville: "Casablanca" }]),
      http.delete(`${API}/admin/villes/1`, () => {
        deleted = true;
        return HttpResponse.json({ message: "City deleted" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete casablanca/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("surfaces a failed delete without closing the confirmation", async () => {
    // A ville still referenced by secteurs cannot be deleted; the backend has no
    // guard, so the FK refusal arrives as a server error (see the backend
    // consultation note in the dialog).
    server.use(
      listHandler([{ id: 1, nom_ville: "Casablanca" }]),
      http.delete(`${API}/admin/villes/1`, () =>
        HttpResponse.json({ message: "Server Error" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete casablanca/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be deleted/i,
    );
  });
});
