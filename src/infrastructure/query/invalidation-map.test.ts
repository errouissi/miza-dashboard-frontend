import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateForEvent, queryKeyPrefixesFor } from "./invalidation-map";

describe("invalidation map", () => {
  it("returns no prefixes for an unregistered event", () => {
    // The registry is empty until Money's first real mutation (M4.2)
    // registers `cheque.approved` — every event is unregistered today.
    expect(queryKeyPrefixesFor("cheque.approved")).toEqual([]);
  });

  it("invalidates nothing, and does not throw, for an unregistered event", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      invalidateForEvent(queryClient, "some.unregistered.event"),
    ).resolves.toEqual([]);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
