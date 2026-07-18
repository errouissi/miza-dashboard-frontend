import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AdminsListPage } from "./admins-list-page";

const API = "http://localhost/api/v1";
const PATH = "/network/admins";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

/** Every granular admin permission — the fully-privileged operator. */
const ALL_ADMIN_PERMISSIONS = [
  PERMISSIONS.ACCESS_DASHBOARD,
  PERMISSIONS.CREATE_ADMIN,
  PERMISSIONS.UPDATE_ADMIN,
  PERMISSIONS.BLOCK_ADMIN,
  PERMISSIONS.DELETE_ADMIN,
];

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * Rows carry `created_at`, `roles` and `permissions` exactly as the backend sends
 * them. `created_at` and `roles` are intentionally unmapped; `permissions` IS
 * mapped (the edit form seeds from it) but is never rendered in the LIST.
 */
function row(id: number, name: string, email: string, isActive: boolean) {
  return {
    id,
    name,
    email,
    is_active: isActive,
    created_at: "2026-01-01T10:00:00.000000Z",
    roles: [{ name: "admin" }],
    permissions: [{ name: "access-dashboard" }],
  };
}

function adminsHandler(rows: ReturnType<typeof row>[], onRequest?: (url: URL) => void) {
  return http.get(`${API}/admin/admins`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(rows);
  });
}

/**
 * The B-6 catalogue: `{ data: [{name, label, group}] }`, name ASC, no links/meta.
 * Blank-named and non-assignable rows are excluded server-side, so the fixture
 * contains none — the frontend does no filtering and must not be tested as if it did.
 */
const CATALOGUE = [
  { name: "access-dashboard", label: "Access Dashboard", group: "Dashboard" },
  { name: "block-admin", label: "Block Admin", group: "Admin Management" },
  { name: "create-admin", label: "Create Admin", group: "Admin Management" },
  { name: "view-agents", label: "View Agents", group: "Agent Management" },
];

function catalogueHandler(entries: typeof CATALOGUE = CATALOGUE, onRequest?: () => void) {
  return http.get(`${API}/admin/permissions`, () => {
    onRequest?.();
    return HttpResponse.json({ data: entries });
  });
}

function renderPage() {
  const router = createMemoryRouter([{ path: PATH, element: <AdminsListPage /> }], {
    initialEntries: [PATH],
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
  signInWith(ALL_ADMIN_PERMISSIONS);
});

describe("admins list — raw-array contract", () => {
  it("renders rows from an unenveloped array", async () => {
    server.use(
      adminsHandler([
        row(1, "Active Admin", "active@example.com", true),
        row(2, "Junior One", "junior1@example.com", false),
      ]),
    );
    renderPage();

    expect(await screen.findByText("Active Admin")).toBeInTheDocument();
    expect(screen.getByText("junior1@example.com")).toBeInTheDocument();
  });

  it("sends NO query parameters — the endpoint accepts none", async () => {
    let url: URL | undefined;
    server.use(adminsHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.search).toBe("");
  });

  it("renders no search box, no sortable header, no pager and no filter row", async () => {
    server.use(adminsHandler([row(1, "Active Admin", "active@example.com", true)]));
    renderPage();

    await screen.findByText("Active Admin");

    expect(screen.queryByLabelText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(adminsHandler([]));
    renderPage();

    expect(await screen.findByText(/no admin yet/i)).toBeInTheDocument();
  });
});

describe("status rendering", () => {
  it("labels the boolean locally, without a shared badge", async () => {
    server.use(
      adminsHandler([
        row(1, "Active Admin", "active@example.com", true),
        row(2, "Blocked Admin", "blocked@example.com", false),
      ]),
    );
    renderPage();

    const activeRow = (await screen.findByText("Active Admin")).closest("tr");
    const blockedRow = screen.getByText("Blocked Admin").closest("tr");

    expect(within(activeRow!).getByText("Active")).toBeInTheDocument();
    expect(within(blockedRow!).getByText("Blocked")).toBeInTheDocument();
  });
});

describe("fields not shown in the list", () => {
  it("does not render created_at, roles or permissions", async () => {
    // created_at and roles are dropped by the mapper. `permissions` IS mapped —
    // the edit form seeds from it — but the LIST has no permissions column, so
    // none of the three may appear here.
    server.use(adminsHandler([row(1, "Active Admin", "active@example.com", true)]));
    renderPage();

    await screen.findByText("Active Admin");

    expect(screen.queryByText(/2026-01-01/)).not.toBeInTheDocument();
    expect(screen.queryByText("admin", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("access-dashboard")).not.toBeInTheDocument();
  });
});

describe("error handling", () => {
  it("shows a retryable error state carrying the support reference", async () => {
    let sentRequestId: string | null = null;
    server.use(
      http.get(`${API}/admin/admins`, ({ request }) => {
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
      http.get(`${API}/admin/admins`, () =>
        shouldFail
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json([row(1, "Active Admin", "active@example.com", true)]),
      ),
    );
    renderPage();

    await screen.findByRole("alert");
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Active Admin")).toBeInTheDocument();
  });
});

describe("granular permission gating — each action on its own permission", () => {
  const rows = [row(1, "Active Admin", "active@example.com", true)];

  it("shows every action to a fully-permitted operator", async () => {
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(screen.getByRole("button", { name: /new admin/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit active admin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block active admin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete active admin/i }),
    ).toBeInTheDocument();
  });

  it("hides CREATE without create-admin, keeping the others", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.UPDATE_ADMIN,
      PERMISSIONS.BLOCK_ADMIN,
      PERMISSIONS.DELETE_ADMIN,
    ]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(screen.queryByRole("button", { name: /new admin/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit active admin/i }),
    ).toBeInTheDocument();
  });

  it("hides EDIT without update-admin, keeping the others", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.CREATE_ADMIN,
      PERMISSIONS.BLOCK_ADMIN,
      PERMISSIONS.DELETE_ADMIN,
    ]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(
      screen.queryByRole("button", { name: /edit active admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block active admin/i }),
    ).toBeInTheDocument();
  });

  it("hides BLOCK without block-admin, keeping the others", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.CREATE_ADMIN,
      PERMISSIONS.UPDATE_ADMIN,
      PERMISSIONS.DELETE_ADMIN,
    ]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(
      screen.queryByRole("button", { name: /block active admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete active admin/i }),
    ).toBeInTheDocument();
  });

  it("hides DELETE without delete-admin, keeping the others", async () => {
    signInWith([
      PERMISSIONS.ACCESS_DASHBOARD,
      PERMISSIONS.CREATE_ADMIN,
      PERMISSIONS.UPDATE_ADMIN,
      PERMISSIONS.BLOCK_ADMIN,
    ]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(
      screen.queryByRole("button", { name: /delete active admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit active admin/i }),
    ).toBeInTheDocument();
  });

  it("FAILS CLOSED — a read-only operator sees the list and no actions at all", async () => {
    // Holds only access-dashboard: the list is legitimately readable, every
    // mutation is not. The UI must show exactly that.
    signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(screen.queryByRole("button", { name: /new admin/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit active admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /block active admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete active admin/i }),
    ).not.toBeInTheDocument();
  });

  it("FAILS CLOSED — an unrelated permission grants nothing", async () => {
    signInWith([PERMISSIONS.ACCESS_DASHBOARD, "some-unrelated-permission"]);
    server.use(adminsHandler(rows));
    renderPage();

    await screen.findByText("Active Admin");
    expect(screen.queryByRole("button", { name: /new admin/i })).not.toBeInTheDocument();
  });
});

describe("create", () => {
  async function openCreateForm() {
    fireEvent.click(await screen.findByRole("button", { name: /new admin/i }));
    return screen.findByRole("dialog");
  }

  it("creates an admin, sending name, email, password and the selected permissions", async () => {
    let created: unknown;
    server.use(
      adminsHandler([]),
      catalogueHandler(),
      http.post(`${API}/admin/admins`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(
          {
            message: "Admin created successfully",
            admin: row(9, "New", "new@x.com", true),
          },
          { status: 201 },
        );
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "New Admin" },
    });
    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText(/password/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(await within(dialog).findByLabelText("Access Dashboard"));
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(created).toEqual({
        name: "New Admin",
        email: "new@example.com",
        password: "supersecret",
        // Exactly the checked NAME — never the label or the group.
        permissions: ["access-dashboard"],
      }),
    );
  });

  it("sends an empty permissions array when nothing is selected", async () => {
    // A new admin with no extra grants is a legitimate outcome, not an error.
    // The backend skips the sync when the array is empty (`filled()`), so the
    // account keeps the `admin` role's defaults.
    let created: Record<string, unknown> | undefined;
    server.use(
      adminsHandler([]),
      catalogueHandler(),
      http.post(`${API}/admin/admins`, async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { admin: row(9, "N", "n@x.com", true) },
          { status: 201 },
        );
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "N" } });
    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: "n@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText(/password/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(created).toBeDefined());
    expect(created!.permissions).toEqual([]);
  });

  it("renders the selector from the CATALOGUE, using its labels", async () => {
    server.use(adminsHandler([]), catalogueHandler());
    renderPage();

    const dialog = await openCreateForm();

    // Labels are shown; names are the payload contract, not the display.
    expect(await within(dialog).findByLabelText("Access Dashboard")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Create Admin")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("View Agents")).toBeInTheDocument();
  });

  it("groups the catalogue by its group field", async () => {
    server.use(adminsHandler([]), catalogueHandler());
    renderPage();

    const dialog = await openCreateForm();

    expect(await within(dialog).findByText("Admin Management")).toBeInTheDocument();
    expect(within(dialog).getByText("Agent Management")).toBeInTheDocument();
    expect(within(dialog).getByText("Dashboard")).toBeInTheDocument();
  });

  it("does NOT fetch the catalogue until the drawer opens", async () => {
    // The endpoint is gated create-admin|update-admin while the LIST is gated
    // access-dashboard, so an unconditional fetch would 403 for read-only operators.
    let fetched = 0;
    server.use(
      adminsHandler([row(1, "Active Admin", "active@example.com", true)]),
      catalogueHandler(CATALOGUE, () => {
        fetched += 1;
      }),
    );
    renderPage();

    await screen.findByText("Active Admin");
    expect(fetched).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /new admin/i }));
    await waitFor(() => expect(fetched).toBe(1));
  });

  it("shows a retryable error when the catalogue fails, without blocking the form", async () => {
    server.use(
      adminsHandler([]),
      http.get(`${API}/admin/permissions`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    const dialog = await openCreateForm();

    expect(
      await within(dialog).findByText(/permission list could not be loaded/i),
    ).toBeInTheDocument();
    // The rest of the form stays usable — a failed catalogue is not a failed form.
    expect(within(dialog).getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("states plainly when the catalogue is empty", async () => {
    server.use(adminsHandler([]), catalogueHandler([]));
    renderPage();

    const dialog = await openCreateForm();
    expect(
      await within(dialog).findByText(/no assignable permissions are available/i),
    ).toBeInTheDocument();
  });

  it("rejects a short password client-side", async () => {
    let posted = false;
    server.use(
      adminsHandler([]),
      http.post(`${API}/admin/admins`, () => {
        posted = true;
        return HttpResponse.json(
          { admin: row(9, "N", "n@x.com", true) },
          { status: 201 },
        );
      }),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "N" } });
    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: "n@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText(/password/i), {
      target: { value: "short" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("maps a duplicate-email 422 onto the email field", async () => {
    server.use(
      adminsHandler([]),
      http.post(`${API}/admin/admins`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { email: ["The email has already been taken."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    const dialog = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText(/name/i), { target: { value: "N" } });
    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: "active@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText(/password/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/already been taken/i)).toBeInTheDocument();
  });
});

describe("edit", () => {
  const rows = [row(1, "Active Admin", "active@example.com", true)];

  it("seeds the drawer with the row and OMITS the password field", async () => {
    // AdminController::update accepts no password, so offering the input would
    // promise something the API ignores.
    server.use(adminsHandler(rows));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Active Admin");
    expect(within(dialog).getByLabelText(/email/i)).toHaveValue("active@example.com");
    expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("OMITS permissions when the selection was not touched", async () => {
    // The load-bearing case. `AdminController::update` syncs whenever the key is
    // present, and sync REPLACES the set — so a rename that sent `permissions`
    // could strip a grant the catalogue cannot represent. Omitting the key leaves
    // the backend's permission state untouched.
    let updated: Record<string, unknown> | undefined;
    server.use(
      adminsHandler(rows),
      catalogueHandler(),
      http.put(`${API}/admin/admins/1`, async ({ request }) => {
        updated = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            message: "Admin updated successfully",
            admin: row(1, "Renamed", "active@example.com", true),
          },
          { status: 201 },
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: "Renamed" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(updated).toEqual({ name: "Renamed", email: "active@example.com" }),
    );
    expect(Object.keys(updated!)).not.toContain("permissions");
  });

  it("SENDS the full permission set once the selection changes", async () => {
    let updated: Record<string, unknown> | undefined;
    server.use(
      adminsHandler(rows),
      catalogueHandler(),
      http.put(`${API}/admin/admins/1`, async ({ request }) => {
        updated = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            message: "Admin updated successfully",
            admin: row(1, "Active Admin", "active@example.com", true),
          },
          { status: 201 },
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");

    // Seeded holds access-dashboard; add create-admin.
    fireEvent.click(await within(dialog).findByLabelText("Create Admin"));
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updated).toBeDefined());
    // Sync semantics: the WHOLE desired set, not a delta.
    expect(updated!.permissions).toEqual(["access-dashboard", "create-admin"]);
  });

  it("seeds the checkboxes from the admin's current grants", async () => {
    server.use(adminsHandler(rows), catalogueHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByLabelText("Access Dashboard")).toBeChecked();
    expect(within(dialog).getByLabelText("Create Admin")).not.toBeChecked();
  });

  it("sends the remaining set when a permission is REMOVED", async () => {
    let updated: Record<string, unknown> | undefined;
    server.use(
      adminsHandler(rows),
      catalogueHandler(),
      http.put(`${API}/admin/admins/1`, async ({ request }) => {
        updated = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { admin: row(1, "Active Admin", "active@example.com", true) },
          { status: 201 },
        );
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");

    // Uncheck the only seeded grant — an empty array is a deliberate revocation.
    fireEvent.click(await within(dialog).findByLabelText("Access Dashboard"));
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updated).toBeDefined());
    expect(updated!.permissions).toEqual([]);
  });

  it("maps a rejected permission 422 onto the permission field", async () => {
    server.use(
      adminsHandler(rows),
      catalogueHandler(),
      http.put(`${API}/admin/admins/1`, () =>
        HttpResponse.json(
          {
            message: "The given data was invalid.",
            errors: { "permissions.0": ["The selected permissions.0 is invalid."] },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByLabelText("Create Admin"));
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

    expect(await within(dialog).findByText(/is invalid/i)).toBeInTheDocument();
  });
});

describe("toggle status", () => {
  it("confirms before blocking, naming the account", async () => {
    server.use(adminsHandler([row(1, "Active Admin", "active@example.com", true)]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block active admin/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/block “Active Admin”/i)).toBeInTheDocument();
  });

  it("sends the PATCH with no body and refreshes", async () => {
    let called = false;
    server.use(
      adminsHandler([row(1, "Active Admin", "active@example.com", true)]),
      http.patch(`${API}/admin/admins/1`, () => {
        called = true;
        return HttpResponse.json({ message: "Admin blocked", is_active: false });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    await waitFor(() => expect(called).toBe(true));
  });

  it("offers ACTIVATE on a blocked account", async () => {
    server.use(adminsHandler([row(2, "Blocked Admin", "blocked@example.com", false)]));
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /activate blocked admin/i }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/activate “Blocked Admin”/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("surfaces a failure without closing the dialog", async () => {
    server.use(
      adminsHandler([row(1, "Active Admin", "active@example.com", true)]),
      http.patch(`${API}/admin/admins/1`, () =>
        HttpResponse.json({ message: "Super admin cannot be blocked" }, { status: 403 }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /block active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /could not be changed/i,
    );
  });
});

describe("delete", () => {
  const rows = [row(1, "Active Admin", "active@example.com", true)];

  it("names the account and its email in the confirmation", async () => {
    server.use(adminsHandler(rows));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete active admin/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/Active Admin/)).toBeInTheDocument();
    expect(within(dialog).getByText(/active@example.com/)).toBeInTheDocument();
  });

  it("deletes on confirmation", async () => {
    let deleted = false;
    server.use(
      adminsHandler(rows),
      http.delete(`${API}/admin/admins/1`, () => {
        deleted = true;
        return HttpResponse.json({ status: "success", message: "deleted" });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("explains the self-delete refusal on a 403", async () => {
    // AdminController::destroy 403s when an operator targets their own account.
    server.use(
      adminsHandler(rows),
      http.delete(`${API}/admin/admins/1`, () =>
        HttpResponse.json(
          { status: "error", message: "You cannot delete your own account." },
          { status: 403 },
        ),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /delete active admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /cannot delete your own account/i,
    );
  });
});
