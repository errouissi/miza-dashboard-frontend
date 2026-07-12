import type { RouteObject } from "react-router-dom";
import { NotFound, RouteErrorBoundary } from "@/app/errors/route-error-boundary";
import { LoginPlaceholder, WelcomePlaceholder } from "@/app/placeholders";
import { LOGIN_PATH } from "./return-path";
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
 *   That generator is NOT built in M1-B: `domainRoutes` is empty, so it would have
 *   zero callers and would be fitted to an imagined shape. It lands with the first
 *   domain route, which is when the shape is evidence instead of a guess.
 *
 * BREADCRUMBS are not rendered anywhere yet, by decision: Design System §2 places
 * the breadcrumb in the PAGE header (above the page title, omitted on top-level
 * lists) — not in the app header. It ships with PageHeader. `handle.breadcrumb`
 * is where the data will come from when it does.
 */

/** Domain route contributions. Empty until the first domain lands. */
const domainRoutes: RouteObject[] = [];

export const routes: RouteObject[] = [
  {
    // The only route outside the shell. A placeholder in M1-B — the login page is
    // the auth flow. It must exist regardless: it is where RequireAuth redirects.
    path: LOGIN_PATH,
    element: <LoginPlaceholder />,
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
