import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateForEvent, queryKeyPrefixesFor } from "./invalidation-map";

describe("invalidation map", () => {
  it("returns no prefixes for an unregistered event", () => {
    // `cheque.approved`/`rejected`/`annuled`/`created` are all registered
    // now (M4.2 Phase 3A/3C) — this asserts the SAFE DEGRADATION for
    // anything else, not that the registry is empty.
    expect(queryKeyPrefixesFor("cheque.some-unregistered-event")).toEqual([]);
  });

  it("registers cheque.created — Cheques' own key space only", () => {
    expect(queryKeyPrefixesFor("cheque.created")).toEqual([["cheques"]]);
  });

  it("registers cheque.approved — Cheques plus both Network balance prefixes", () => {
    expect(queryKeyPrefixesFor("cheque.approved")).toEqual([
      ["cheques"],
      ["managers"],
      ["commercials"],
    ]);
  });

  it("registers cheque.annuled — the same prefixes as cheque.approved (it reverses the same columns)", () => {
    expect(queryKeyPrefixesFor("cheque.annuled")).toEqual([
      ["cheques"],
      ["managers"],
      ["commercials"],
    ]);
  });

  it("registers cheque.rejected — Cheques' own key space only (no balance column touched)", () => {
    expect(queryKeyPrefixesFor("cheque.rejected")).toEqual([["cheques"]]);
  });

  it("registers deposit.validated — Deposits' own key space only, no Network prefix (unlike cheque.approved)", () => {
    expect(queryKeyPrefixesFor("deposit.validated")).toEqual([["deposits"]]);
  });

  it("registers deposit.rejected — Deposits' own key space only", () => {
    expect(queryKeyPrefixesFor("deposit.rejected")).toEqual([["deposits"]]);
  });

  it("registers deposit.created — Deposits' own key space only", () => {
    expect(queryKeyPrefixesFor("deposit.created")).toEqual([["deposits"]]);
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
