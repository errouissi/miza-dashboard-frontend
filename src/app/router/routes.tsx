import type { RouteObject } from "react-router-dom";
import {
  Forbidden,
  NotFound,
  RouteErrorBoundary,
} from "@/app/errors/route-error-boundary";
import { WelcomePlaceholder } from "@/app/placeholders";
import { RequirePermission } from "@/app/guards";
import { adminsRoutes } from "@/domains/network/admins";
import { productsRoutes } from "@/domains/reference/products";
import { secteursRoutes } from "@/domains/reference/secteurs";
import { villesRoutes } from "@/domains/reference/villes";
import { LOGIN_PATH } from "./return-path";
import { LoginRoute } from "./login-route";
import { ProtectedShell } from "./protected-shell";

/**
 * The route table (FTA §5).
 *
 * Routes are CONTRIBUTED by domains and ASSEMBLED here. No hand-maintained central
 * list of every screen — that file is always out of date, and the Discovery report
 * found five legacy routes with no permission guard at all because of exactly that.
 *
 * THE DOMAIN CONTRIBUTION CONTRACT (documented now, implemented when there is a
 * caller — FTA D-11):
 *
 *   Each resource exports its own route objects carrying, in `handle`:
 *     - `permission`: the string from the central registry that gates the route
 *     - `breadcrumb`: the label for the trail
 *
 *   The assembler wraps each in RequirePermission using `handle.permission`, so the
 *   guard is generated from the declaration rather than hand-wrapped per route.
 *
 *   The generator below landed with Villes — the first domain route — which is
 *   when its shape became evidence instead of a guess.
 *
 * BREADCRUMBS are not rendered anywhere yet, by decision: Design System §2 places
 * the breadcrumb in the PAGE header (above the page title, omitted on top-level
 * lists) — not in the app header. It ships with PageHeader. `handle.breadcrumb`
 * is where the data will come from when it does.
 */

type RouteHandle = {
  permission?: string;
  breadcrumb?: string;
};

/**
 * Generates each route's permission guard from its own declaration.
 *
 * A route that declares no permission is a BUG, not a public route: everything
 * assembled here already sits behind ProtectedShell, so an undeclared permission
 * means someone forgot one. It fails closed — rendering the 403 rather than the
 * page — because the alternative (defaulting to "allow") turns a forgotten
 * declaration into an invisible hole.
 *
 * The refusal is UNCONDITIONAL, not a lookup of some sentinel string. Asking the
 * resolver whether the session holds `""` would also refuse today, but only
 * because no permission happens to be named `""` — that is a coincidence standing
 * in for a security decision, and it opens every undeclared route the day a
 * malformed grant puts an empty string in the list.
 *
 * The fallback is the calm 403, NOT a redirect to login: the session is valid,
 * the operator simply may not open this (FTA §11).
 *
 * SHALLOW BY DESIGN: only the routes passed in are wrapped. No resource
 * contributes `children` yet, so recursing would be fitting a generator to an
 * imagined shape (FTA D-11). Note the consequence for whoever adds the first
 * nested route: a child route's own `handle.permission` would NOT be applied —
 * it would inherit its parent's guard through the Outlet. Handle it then, with
 * the real shape in front of you.
 */
function withPermissionGuards(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    const { permission } = (route.handle ?? {}) as RouteHandle;

    return {
      ...route,
      element:
        permission === undefined ? (
          <Forbidden />
        ) : (
          <RequirePermission permission={permission} fallback={<Forbidden />}>
            {route.element}
          </RequirePermission>
        ),
    };
  });
}

/** Domain route contributions, assembled from each resource's public surface. */
const domainRoutes: RouteObject[] = withPermissionGuards([
  ...villesRoutes,
  ...secteursRoutes,
  ...productsRoutes,
  ...adminsRoutes,
]);

/**
 * Test-only seam for the fail-closed case. Exported because the behaviour it
 * guards — an undeclared permission must refuse, not allow — cannot be reached
 * through the real route table, which by design has no undeclared route.
 */
export const withPermissionGuardsForTest = withPermissionGuards;

export const routes: RouteObject[] = [
  {
    // The only route outside the shell. It must exist regardless: it is where
    // RequireAuth redirects (protected-shell.tsx).
    path: LOGIN_PATH,
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: <ProtectedShell />,
    // A crash in the shell ITSELF (sidebar, header) lands here. Last resort.
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        // A pathless layout route whose only job is to own the error boundary for
        // every page below it. Because the boundary is a CHILD of the shell, a
        // crashed page renders inside the Outlet and the sidebar and header stay
        // usable — the operator can navigate away from a broken page (FTA §11).
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            element: <WelcomePlaceholder />,
          },
          ...domainRoutes,
          {
            // In-shell 404 — never a bare error page (Design System §23).
            path: "*",
            element: <NotFound />,
          },
        ],
      },
    ],
  },
];
