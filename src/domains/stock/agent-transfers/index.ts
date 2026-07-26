export {
  AGENT_TRANSFERS_PATH,
  AGENT_TRANSFER_NEW_PATH,
  AGENT_TRANSFER_DETAIL_PATH,
  agentTransferDetailPath,
  agentTransfersRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's data (FTA §4). Every `*_PATH`
// constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.
