import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryProvider } from "@/app/providers/query-provider";
import { wireSessionTermination } from "@/app/bootstrap/wire-session";
import { router } from "@/app/router/router";

/**
 * The application root — composition only.
 *
 * There is no SessionProvider, and its absence is a decision: the session is an
 * external store subscribed via useSyncExternalStore, because a Provider would have
 * to live in app/ and domains/ may not import app/ (FTA §4). It also deletes a bug
 * class outright — there is no Provider to forget to mount.
 *
 * Session termination is wired on mount rather than at module scope, so the
 * subscription is owned by a React lifecycle and torn down cleanly in tests.
 */
export function App() {
  useEffect(() => wireSessionTermination(), []);

  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}
