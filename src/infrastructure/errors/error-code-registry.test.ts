import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";
import { resolveErrorDisplay } from "./error-code-registry";

describe("error-code registry", () => {
  it("degrades gracefully for an unregistered code, still surfacing the code", () => {
    // Entries are empty until O-1 is signed, so EVERY code is unregistered today.
    // The fallback is therefore the only path that runs — and it must never produce
    // a blank screen. An unknown failure degrades to "unhelpful but diagnosable".
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "ALLOCATION_STOCK_INSUFFICIENT",
        requestId: "req-9",
      }),
    );

    expect(display.message).toBeUndefined(); // copy is owned by the copy layer (O-1)
    expect(display.code).toBe("ALLOCATION_STOCK_INSUFFICIENT"); // quotable to support
    expect(display.requestId).toBe("req-9");
    expect(display.tone).toBe("danger"); // a failure is never "info"
  });

  it("carries the correlation reference even when there is no code", () => {
    const display = resolveErrorDisplay(
      new AppError({ kind: "server", requestId: "req-5" }),
    );

    expect(display.code).toBeUndefined();
    expect(display.requestId).toBe("req-5");
    expect(display.tone).toBe("danger");
  });
});
