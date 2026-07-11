import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** The MSW server shared by every test. Lifecycle is managed in src/test/setup.ts. */
export const server = setupServer(...handlers);
