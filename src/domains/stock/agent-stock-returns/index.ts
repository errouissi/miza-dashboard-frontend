export {
  AGENT_STOCK_RETURNS_PATH,
  AGENT_STOCK_RETURN_NEW_PATH,
  AGENT_STOCK_RETURN_DETAIL_PATH,
  agentStockReturnDetailPath,
  agentStockReturnsRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's data (FTA §4). Every `*_PATH`
// constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.
