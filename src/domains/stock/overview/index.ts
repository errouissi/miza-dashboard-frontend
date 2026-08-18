export { STOCK_OVERVIEW_PATH, stockOverviewRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. No
// sibling domain reads this resource's data (FTA §4). STOCK_OVERVIEW_PATH
// is exported only because route-authorization.test.tsx (outside this
// domain) needs it for its own parametrized coverage array, mirroring
// every sibling Stock resource's own index.ts.
