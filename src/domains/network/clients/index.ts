export {
  CLIENTS_PATH,
  CLIENT_DETAIL_PATH,
  clientDetailPath,
  clientsRoutes,
} from "./routes";

/**
 * Widened for Agent 360's Commercial-side Clients panel (Manager Demo
 * Readiness, Item 3) — the first cross-domain caller of Clients' own public
 * surface (mechanism 1, FTA §4: the Network/Agents domain imports this
 * export, Clients learns nothing about Agents). Mirrors how
 * `domains/grattage/invoices/index.ts` widened for Client 360's own
 * cross-domain panel.
 */
export { useClientsQuery } from "./queries/clients-queries";
export {
  CLIENT_LIST_DEFAULTS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
  type Client,
} from "./model/client";

// api/, components/ and the page stay internal.
