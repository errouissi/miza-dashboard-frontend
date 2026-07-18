import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ProductsListPage } from "./products-list-page";

const API = "http://localhost/api/v1";
const PATH = "/reference/products";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/**
 * Rows carry created_at / updated_at exactly as the backend sends them —
 * `products` has timestamps and the model sets no $hidden. The mapper must drop
 * them, and nothing downstream may depend on them.
 */
function row(id: number, name: string, operator: string, value: number) {
  return {
    id,
    name,
    operator,
    value,
    created_at: "2026-01-01T10:00:00.000000Z",
    updated_at: "2026-01-02T10:00:00.000000Z",
  };
}

function productsHandler(rows: ReturnType<typeof row>[], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/products`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(rows);
  });
}

function renderPage(initialPath = PATH) {
  const router = createMemoryRouter([{ path: PATH, element: <ProductsListPage /> }], {
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

describe("products list — raw-array contract", () => {
  it("renders rows from an unenveloped array", async () => {
    server.use(
      productsHandler([row(1, "Card 10", "IAM", 10), row(2, "Card 50", "INWI", 50)]),
    );
    renderPage();

    expect(await screen.findByText("Card 10")).toBeInTheDocument();
    expect(screen.getByText("Card 50")).toBeInTheDocument();
  });

  it("sends NO pagination, search or sort parameters", async () => {
    let url: URL | undefined;
    server.use(productsHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());

    expect(url?.searchParams.has("page")).toBe(false);
    expect(url?.searchParams.has("per_page")).toBe(false);
    expect(url?.searchParams.has("search")).toBe(false);
    expect(url?.searchParams.has("sort")).toBe(false);
    expect(url?.searchParams.has("direction")).toBe(false);
    expect(url?.searchParams.has("operator")).toBe(false);
  });

  it("renders no search box, no sortable header and no pager", async () => {
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    await screen.findByText("Card 10");

    expect(screen.queryByLabelText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(productsHandler([]));
    renderPage();

    expect(await screen.findByText(/no product yet/i)).toBeInTheDocument();
  });

  it("shows a distinct empty state when an operator filter is applied", async () => {
    server.use(productsHandler([]));
    renderPage(`${PATH}?operator=INWI`);

    expect(await screen.findByText(/no product for this operator/i)).toBeInTheDocument();
  });
});

describe("value rendering", () => {
  it("renders value as money through the shared formatter", async () => {
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    // Design System §5: Moroccan French money — two decimals, currency after.
    expect(await screen.findByText(/10,00\s*DH/)).toBeInTheDocument();
  });

  it("renders a ZERO value as money, not as the absent dash", async () => {
    // The backend permits value=0 (`min:0`). Absent and zero are different facts:
    // a zero-value product is a real product, not a missing figure.
    server.use(productsHandler([row(1, "Free SIM", "ORANGE", 0)]));
    renderPage();

    const cell = (await screen.findByText("Free SIM")).closest("tr");
    expect(within(cell!).getByText(/0,00\s*DH/)).toBeInTheDocument();
    expect(within(cell!).queryByText("—")).not.toBeInTheDocument();
  });

  it("groups thousands in large denominations", async () => {
    server.use(productsHandler([row(1, "Bulk", "IAM", 12500)]));
    renderPage();

    expect(await screen.findByText(/12\s*500,00\s*DH/)).toBeInTheDocument();
  });
});

describe("timestamps are not mapped", () => {
  it("does not render created_at or updated_at anywhere", async () => {
    // They arrive on every row and are dropped by the mapper (FTA D-11: no caller).
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    await screen.findByText("Card 10");

    expect(screen.queryByText(/2026-01-01/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-01-02/)).not.toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      http.get(`${API}/admin/products`, ({ request }) => {
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
      http.get(`${API}/admin/products`, () =>
        shouldFail
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json([row(1, "Card 10", "IAM", 10)]),
      ),
    );
    renderPage();

    await screen.findByRole("alert");
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Card 10")).toBeInTheDocument();
  });
});

describe("operator filter — the one filter the API supports", () => {
  it("reads the filter from the URL and forwards it", async () => {
    let url: URL | undefined;
    server.use(productsHandler([], (u) => (url = u)));
    renderPage(`${PATH}?operator=INWI`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("operator")).toBe("INWI");
  });

  it("writes the filter into the URL when changed", async () => {
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    const router = renderPage();

    await screen.findByText("Card 10");
    fireEvent.change(screen.getByLabelText(/filter by operator/i), {
      target: { value: "ORANGE" },
    });

    await waitFor(() => expect(router.state.location.search).toBe("?operator=ORANGE"));
  });

  it("clears the filter out of the URL entirely", async () => {
    server.use(productsHandler([]));
    const router = renderPage(`${PATH}?operator=IAM`);

    await screen.findByLabelText(/filter by operator/i);
    fireEvent.change(screen.getByLabelText(/filter by operator/i), {
      target: { value: "" },
    });

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("IGNORES an operator outside the backend enum", async () => {
    let url: URL | undefined;
    server.use(productsHandler([], (u) => (url = u)));
    renderPage(`${PATH}?operator=VERIZON`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.has("operator")).toBe(false);
  });
});

describe("permission-gated actions", () => {
  it("renders create/edit/delete for a permitted session", async () => {
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    await screen.findByText("Card 10");
    expect(screen.getByRole("button", { name: /new product/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit card 10/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete card 10/i })).toBeInTheDocument();
  });

  it("renders NO action controls without the permission", async () => {
    sessionManager.__resetForTests();
    sessionManager.start({ token: "tok", user: { ...baseUser, permissions: [] } });

    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    await screen.findByText("Card 10");
    expect(
      screen.queryByRole("button", { name: /new product/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit card 10/i }),
    ).not.toBeInTheDocument();
  });
});

describe("create / edit / delete", () => {
  async function openCreateForm() {
    fireEvent.click(await screen.findByRole("button", { name: /new product/i }));
    return screen.findByRole("dialog");
  }

  it("creates a product from the raw 201 envelope", async () => {
    let created: unknown;
    server.use(
      productsHandler([]),
      http.post(`${API}/admin/products`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(row(9, "Card 20", "IAM", 20), { status: 201 });
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Card 20" },
    });
    fireEvent.change(within(dialog).getByLabelText(/operator/i), {
      target: { value: "IAM" },
    });
    fireEvent.change(within(dialog).getByLabelText(/value/i), {
      target: { value: "20" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(created).toEqual({ name: "Card 20", operator: "IAM", value: 20 }),
    );
  });

  it("offers exactly the three backend operators", async () => {
    server.use(productsHandler([]));
    renderPage();

    const dialog = await openCreateForm();
    const select = within(dialog).getByLabelText(/operator/i);

    expect(within(select).getByRole("option", { name: "IAM" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "INWI" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "ORANGE" })).toBeInTheDocument();
  });

  it("refuses to submit without an operator", async () => {
    let posted = false;
    server.use(
      productsHandler([]),
      http.post(`${API}/admin/products`, () => {
        posted = true;
        return HttpResponse.json(row(9, "X", "IAM", 1), { status: 201 });
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByLabelText(/value/i), {
      target: { value: "10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/operator is required/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("refuses an EMPTY value rather than submitting zero", async () => {
    // The regression this schema's string-then-coerce order exists to prevent:
    // z.coerce.number() turns "" into 0, which would silently create a 0 DH
    // product instead of raising "required".
    let posted = false;
    server.use(
      productsHandler([]),
      http.post(`${API}/admin/products`, () => {
        posted = true;
        return HttpResponse.json(row(9, "X", "IAM", 0), { status: 201 });
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByLabelText(/operator/i), {
      target: { value: "IAM" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/value is required/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("refuses a DECIMAL value client-side rather than letting the server 422", async () => {
    let posted = false;
    server.use(
      productsHandler([]),
      http.post(`${API}/admin/products`, () => {
        posted = true;
        return HttpResponse.json(row(9, "X", "IAM", 12), { status: 201 });
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByLabelText(/operator/i), {
      target: { value: "IAM" },
    });
    fireEvent.change(within(dialog).getByLabelText(/value/i), {
      target: { value: "12.5" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/whole number/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("maps the composite-unique 422 onto the name field", async () => {
    // Uniqueness is name PER operator, reported by Laravel against `name`.
    server.use(
      productsHandler([]),
      http.post(`${API}/admin/products`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { name: ["The name has already been taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Card 10" },
    });
    fireEvent.change(within(dialog).getByLabelText(/operator/i), {
      target: { value: "IAM" },
    });
    fireEvent.change(within(dialog).getByLabelText(/value/i), {
      target: { value: "10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/already been taken/i)).toBeInTheDocument();
  });

  it("seeds the edit drawer with name, operator and value", async () => {
    server.use(productsHandler([row(1, "Card 50", "INWI", 50)]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit card 50/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Card 50");
    expect(within(dialog).getByLabelText(/operator/i)).toHaveValue("INWI");
    expect(within(dialog).getByLabelText(/value/i)).toHaveValue(50);
  });

  it("sends the update through the wrapped envelope, resending all three fields", async () => {
    let updated: unknown;
    server.use(
      productsHandler([row(1, "Card 50", "INWI", 50)]),
      http.put(`${API}/admin/products/1`, async ({ request }) => {
        updated = await request.json();
        return HttpResponse.json({
          status: "success",
          message: "Product updated successfully",
          data: row(1, "Card 50 Plus", "INWI", 50),
        });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit card 50/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Card 50 Plus" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    // All three are `required` on update — unchanged fields must still be sent.
    await waitFor(() =>
      expect(updated).toEqual({ name: "Card 50 Plus", operator: "INWI", value: 50 }),
    );
  });

  it("names the product in the delete confirmation", async () => {
    server.use(productsHandler([row(1, "Card 10", "IAM", 10)]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete card 10/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/card 10/i)).toBeInTheDocument();
  });

  it("deletes on confirmation", async () => {
    let deleted = false;
    server.use(
      productsHandler([row(1, "Card 10", "IAM", 10)]),
      http.delete(`${API}/admin/products/1`, () => {
        deleted = true;
        return HttpResponse.json({ message: "Product deleted" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete card 10/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("surfaces a failed delete without closing the confirmation", async () => {
    // Product has THREE inbound relations and no in-use guard, so an FK violation
    // arrives as a 500 (BC-I). The copy stays hedged.
    server.use(
      productsHandler([row(1, "Card 10", "IAM", 10)]),
      http.delete(`${API}/admin/products/1`, () =>
        HttpResponse.json({ message: "Server Error" }, { status: 500 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete card 10/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be deleted/i,
    );
  });
});
