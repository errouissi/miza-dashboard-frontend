import { beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { NotFound, RouteErrorBoundary } from "@/app/errors/route-error-boundary";
import { routes } from "./routes";
import { ProtectedShell } from "./protected-shell";

const session = {
  token: "tok",
  user: {
    id: 1,
    name: "Ahmed Errouissi",
    email: "ahmed@example.com",
    roles: ["admin"],
    permissions: [] as string[],
  },
};

/** The same operator, holding the permission every villes action is gated behind. */
const permittedSession = {
  ...session,
  user: { ...session.user, permissions: [PERMISSIONS.ACCESS_DASHBOARD] },
};

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] });
  // A QueryClientProvider is required as of M1-C: the login and logout mutations
  // (LoginRoute -> LoginPage, AppHeader) both call useMutation.
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("protected routes", () => {
  it("redirects an unauthenticated visitor to login, preserving the return path", () => {
    const router = renderAt("/stock/bons");

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Fstock%2Fbons");
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the shell for an authenticated user", () => {
    sessionManager.start(session);
    renderAt("/");

    // The frame.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    // The identity of the person acting, behind the logout menu.
    expect(screen.getByText("Ahmed Errouissi")).toBeInTheDocument();
    // The authenticated landing placeholder, inside the shell.
    expect(screen.getByRole("heading", { name: "Miza Dashboard" })).toBeInTheDocument();
  });

  it("renders a logout control behind the identity menu", () => {
    // M1-C: the revocation endpoint now exists, so the control ships (see
    // app-header.tsx and domains/auth/queries/mutations.ts).
    sessionManager.start(session);
    renderAt("/");

    // Radix's DropdownMenuTrigger opens on pointerdown, not click.
    fireEvent.pointerDown(screen.getByText("Ahmed Errouissi"), { button: 0 });

    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });

  it("does not render a breadcrumb in the app header", () => {
    // Design System §2 places the breadcrumb in the PAGE header, not the shell.
    sessionManager.start(session);
    renderAt("/");

    expect(
      screen.queryByRole("navigation", { name: /breadcrumb|fil d'ariane/i }),
    ).toBeNull();
  });
});

describe("sidebar", () => {
  it("renders no nav groups for a session with no permissions", () => {
    // `session` holds permissions: []. The Villes entry exists in the tree but is
    // filtered out — nav visibility follows permissions, not route existence.
    sessionManager.start(session);
    renderAt("/");

    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders the Villes nav item for a permitted session", () => {
    sessionManager.start(permittedSession);
    renderAt("/");

    expect(screen.getByRole("link", { name: /villes/i })).toBeInTheDocument();
  });
});

describe("error containment", () => {
  it("renders the in-shell 404 for an unknown route, with a path back", () => {
    sessionManager.start(session);
    renderAt("/nope/nowhere");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Page introuvable/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accueil/i })).toBeInTheDocument();

    // Still inside the shell — the operator can navigate away.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("SURVIVES a crashed page: the shell stays usable", () => {
    // The assertion that matters most in this milestone. A boundary that takes the
    // whole shell down turns one broken page into a dead application.
    sessionManager.start(session);

    const Boom = () => {
      throw new Error("page exploded");
    };

    const withBoom: RouteObject[] = [
      {
        path: "/",
        element: <ProtectedShell />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            errorElement: <RouteErrorBoundary />,
            children: [
              { index: true, element: <Boom /> },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
    ];

    renderAt("/", withBoom);

    // The error state rendered...
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // ...and the shell is still standing around it.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Errouissi")).toBeInTheDocument();
  });
});
