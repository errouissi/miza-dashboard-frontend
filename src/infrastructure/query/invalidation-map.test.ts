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

  it("registers debt-payment.created — Debt Payments' own key space only", () => {
    expect(queryKeyPrefixesFor("debt-payment.created")).toEqual([["debt-payments"]]);
  });

  it("registers agent-stock-return.created — Agent Stock Returns' own key space only", () => {
    expect(queryKeyPrefixesFor("agent-stock-return.created")).toEqual([
      ["agent-stock-returns"],
    ]);
  });

  it("registers agent-stock-return.line-changed — Agent Stock Returns' own key space only", () => {
    expect(queryKeyPrefixesFor("agent-stock-return.line-changed")).toEqual([
      ["agent-stock-returns"],
    ]);
  });

  it("registers agent-stock-return.validated — no cross-domain prefix yet (no stock-read consumer exists)", () => {
    expect(queryKeyPrefixesFor("agent-stock-return.validated")).toEqual([
      ["agent-stock-returns"],
    ]);
  });

  it("registers agent-transfer.created — Agent Transfers' own key space only", () => {
    expect(queryKeyPrefixesFor("agent-transfer.created")).toEqual([["agent-transfers"]]);
  });

  it("registers agent-transfer.line-changed — Agent Transfers' own key space only", () => {
    expect(queryKeyPrefixesFor("agent-transfer.line-changed")).toEqual([
      ["agent-transfers"],
    ]);
  });

  it("registers agent-transfer.validated — no cross-domain prefix (writes only stocks/stock_movements, not Agent balance columns)", () => {
    expect(queryKeyPrefixesFor("agent-transfer.validated")).toEqual([
      ["agent-transfers"],
    ]);
  });

  it("registers allocation.created — Allocations' own key space only", () => {
    expect(queryKeyPrefixesFor("allocation.created")).toEqual([["allocations"]]);
  });

  it("registers allocation.line-changed — Allocations' own key space only", () => {
    expect(queryKeyPrefixesFor("allocation.line-changed")).toEqual([["allocations"]]);
  });

  it("registers allocation.validated — no cross-domain prefix (writes stocks/stock_movements/allocation_deposit_consumptions, not Agent balance or Deposit columns)", () => {
    expect(queryKeyPrefixesFor("allocation.validated")).toEqual([["allocations"]]);
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
