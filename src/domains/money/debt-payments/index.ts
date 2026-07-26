export { DEBT_PAYMENTS_PATH, DEBT_PAYMENTS_NEW_PATH, debtPaymentsRoutes } from "./routes";

// api/, model/, queries/ and the pages stay internal. No sibling domain
// reads this resource's data (FTA §4). Every `*_PATH` constant is exported
// only because `route-authorization.test.tsx` (outside this domain) needs
// it for its own parametrized coverage array.
