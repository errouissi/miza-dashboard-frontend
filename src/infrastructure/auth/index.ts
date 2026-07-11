export { getAccessToken, sessionManager } from "./session-manager";
export type { Session, SessionUser } from "./session-types";

// `sessionStore` is intentionally NOT exported. Nothing outside this module may
// know that storage exists, let alone which storage it is (FTA §14, D-16).
