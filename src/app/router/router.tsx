import { createBrowserRouter } from "react-router-dom";
import { routes } from "./routes";

/**
 * The application router.
 *
 * A DATA ROUTER (createBrowserRouter), not <BrowserRouter>, and the reason is
 * concrete rather than stylistic: FTA §11 requires a 401 to terminate the session
 * and redirect CENTRALLY, from the HTTP interceptor — which lives outside React.
 * A data router gives a `router` object whose `.navigate()` is callable from a
 * plain module. The alternatives (a global history singleton, or a navigate-ref
 * assigned from inside a component) are the same global with more moving parts.
 *
 * This module-scoped instance is therefore the ONE sanctioned escape hatch of its
 * kind, and it has exactly one caller: the session-termination handler. A second
 * caller is a design smell to review, not a precedent to follow.
 *
 * Loaders and actions remain unused (FTA D-4). The router routes; TanStack Query
 * fetches. Two systems that both fetch means two caches and two invalidation
 * stories, fresh in one and stale in the other.
 */
export const router = createBrowserRouter(routes);
