import type { RequestHandler } from "msw";

/**
 * Default MSW handlers, applied to every test run.
 *
 * Intentionally empty at M0. Domain handlers arrive with their resources, and
 * fixtures MUST be derived from the backend's documented contract (the Postman
 * collection), never invented — FTA D-15, contract drift.
 */
export const handlers: RequestHandler[] = [];
