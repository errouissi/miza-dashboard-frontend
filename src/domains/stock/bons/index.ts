export {
  BONS_PATH,
  BON_NEW_PATH,
  BON_DETAIL_PATH,
  bonDetailPath,
  bonsRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's data (FTA §4). Every `*_PATH`
// constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.
