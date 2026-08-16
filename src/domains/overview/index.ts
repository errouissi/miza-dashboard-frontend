/**
 * Overview's public surface. Unlike every resource domain, Overview
 * contributes no route SUBTREE of its own (no list/detail/create pages,
 * no `*_PATH` constants) — it replaces a single element at the app
 * shell's own pre-existing index route (`/`, see `app/router/routes.tsx`).
 * `OverviewPage` is exported here, not left as an internal reach-in,
 * purely so `app/router/routes.tsx` can import it through the domain's
 * own front door — the identical boundary discipline every other
 * `@/domains/<domain>/<resource>` import already follows (the deep-import
 * ESLint rule forbids `@/domains/overview/pages/overview-page` from
 * outside this domain).
 */
export { OverviewPage } from "./pages/overview-page";
