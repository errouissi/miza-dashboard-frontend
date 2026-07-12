import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

/**
 * jsdom does not implement matchMedia, and the sidebar primitive needs it to decide
 * between the desktop rail and the mobile sheet. Without this stub the entire App
 * Shell is untestable. Defaults to "not mobile" — the desktop reference layout.
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// `onUnhandledRequest: "error"` is deliberate: a request with no handler is a
// test reaching for a real network, and it must fail loudly rather than hang.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
