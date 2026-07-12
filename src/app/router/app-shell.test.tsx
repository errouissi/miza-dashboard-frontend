import { beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { sessionManager } from "@/infrastructure/auth";
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
    permissions: [],
  },
};

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
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
    expect(screen.getByText(/Connexion/i)).toBeInTheDocument();
  });

  it("renders the shell for an authenticated user", () => {
    sessionManager.start(session);
    renderAt("/");

    // The frame.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    // The identity of the person acting (header shows it; no logout yet).
    expect(screen.getByText("Ahmed Errouissi")).toBeInTheDocument();
    // The authenticated landing placeholder, inside the shell.
    expect(screen.getByRole("heading", { name: "Miza Dashboard" })).toBeInTheDocument();
  });

  it("does not render a logout control", () => {
    // A client-only logout would leave the bearer token valid server-side. Asserted
    // so nobody "helpfully" adds one before the revocation endpoint exists.
    sessionManager.start(session);
    renderAt("/");

    expect(screen.queryByRole("button", { name: /déconnexion|logout/i })).toBeNull();
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
  it("renders no nav groups when the nav tree is empty", () => {
    // The honest M1-B result: no domains exist, so there is nothing to navigate to.
    // Permission filtering itself is covered exhaustively in nav.test.ts.
    sessionManager.start(session);
    renderAt("/");

    expect(screen.queryByRole("list")).toBeNull();
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
