import { sessionManager } from "@/infrastructure/auth";
import { router } from "@/app/router/router";
import { buildLoginPath } from "@/app/router/return-path";

/**
 * The composition point where "the session ended" becomes "go to login".
 *
 * This is the ONLY module that knows both that a session exists and that a router
 * exists. Infrastructure announces the fact; the app layer decides what it means
 * (FTA §2). That separation is what keeps `infrastructure/auth` free of React and
 * react-router — and therefore unit-testable without either.
 *
 * It closes the gap Discovery found in the legacy build: "a 401 mid-session has no
 * defined UX." It now has one, in exactly one place.
 *
 * `sessionManager.terminate()` is idempotent and single-flight, so this handler
 * fires EXACTLY ONCE even when a dashboard page's five in-flight requests all come
 * back 401 within milliseconds. Without that guarantee this would be five
 * navigations — a flickering redirect loop that is miserable to diagnose.
 */
export function wireSessionTermination(): () => void {
  return sessionManager.onSessionEnded(() => {
    // The ROUTER's location, not window.location. The router owns where the
    // application is; window.location can lag behind it (and does, the moment
    // anything navigates without a full page load). Reading the wrong one produces
    // a return path pointing at the previous page — which is the kind of bug that
    // only ever shows up as "logging back in sent me somewhere odd".
    const { pathname, search } = router.state.location;
    const returnTo = `${pathname}${search}`;

    // `replace`: the expired page must not sit in the history stack, or the browser
    // back button walks the operator straight back into a dead session.
    void router.navigate(buildLoginPath(returnTo), { replace: true });
  });
}
