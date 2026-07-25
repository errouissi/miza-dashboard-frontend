export {
  DEPOSITS_PATH,
  DEPOSIT_DETAIL_PATH,
  depositDetailPath,
  depositsRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's picker or public surface yet
// (FTA §4). Every `*_PATH` constant is exported only because
// `route-authorization.test.tsx` (outside this domain) needs it for its
// own parametrized coverage array. `depositDetailPath` is exported
// alongside `DEPOSIT_DETAIL_PATH` because the raw pattern
// (`/money/deposits/:id`) is not itself a navigable URL — the list page
// and tests need the id-substituted builder, not the route pattern.
