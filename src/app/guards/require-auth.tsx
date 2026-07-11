import type { ReactNode } from "react";
import { useIsAuthenticated } from "@/shared/hooks";

type RequireAuthProps = {
  children: ReactNode;
  /**
   * Rendered when there is no session. The router supplies the redirect in M1-B;
   * the guard itself stays router-agnostic so it can also gate a panel, not just
   * a route.
   */
  fallback?: ReactNode;
};

/**
 * Route guard: is there a session at all? (FTA §5, §6)
 *
 * Guards are the mechanism; the route table that applies them arrives in M1-B, where
 * every route carries its permission declaratively so that "a route that exists is a
 * route that is guarded" — there is no unguarded code path in which to forget one.
 */
export function RequireAuth({ children, fallback = null }: RequireAuthProps) {
  return useIsAuthenticated() ? <>{children}</> : <>{fallback}</>;
}
