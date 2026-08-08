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

/**
 * jsdom does not implement the Pointer Events capture API. Radix's dropdown menu
 * (and other Radix primitives) call `hasPointerCapture`/`setPointerCapture` on
 * their trigger internally; without these, the calls throw and the menu never
 * opens in a test, silently — `aria-expanded` just stays "false". Same category
 * of gap as the matchMedia stub above, same fix: a minimal jsdom polyfill.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * jsdom does not implement `URL.createObjectURL`/`revokeObjectURL` — needed
 * by `FileUploadField`'s own local-file preview (M7 Phase 1.5, the first
 * caller to preview a selected file rather than just name it). A fake,
 * unique-per-call URL is sufficient: nothing in a test actually loads it as
 * an image, only asserts the `<img src>` it was assigned.
 */
if (!URL.createObjectURL) {
  let counter = 0;
  URL.createObjectURL = () => `blob:mock-${++counter}`;
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// `onUnhandledRequest: "error"` is deliberate: a request with no handler is a
// test reaching for a real network, and it must fail loudly rather than hang.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
