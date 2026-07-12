import { Navigate, useLocation } from "react-router-dom";
import { RequireAuth } from "@/app/guards";
import { AppShell } from "@/app/layouts/app-shell";
import { buildLoginPath } from "./return-path";

/**
 * The authenticated branch of the route table.
 *
 * Everything below `/` passes through here, which is what makes "a route that
 * exists is a route that is guarded" structurally true rather than a convention —
 * there is no unguarded code path in which to forget the guard (FTA §5).
 *
 * The return path is preserved so that logging back in returns an operator to the
 * work they were doing, and it is validated as in-app before being written into the
 * URL (see return-path.ts).
 */
export function ProtectedShell() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <RequireAuth fallback={<Navigate to={buildLoginPath(returnTo)} replace />}>
      <AppShell />
    </RequireAuth>
  );
}
