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

  it("registers deposit.validated — Deposits, plus Grattage Invoices and Grattage Outstanding (M6 Phase 2: settling flips invoice status and clears the restock gate)", () => {
    expect(queryKeyPrefixesFor("deposit.validated")).toEqual([
      ["deposits"],
      ["grattage-invoices"],
      ["grattage-outstanding"],
    ]);
  });

  it("registers deposit.rejected — Deposits, plus Grattage Invoices and Grattage Outstanding (M6 Phase 2: unlinking re-enables Cancel and raises the outstanding total)", () => {
    expect(queryKeyPrefixesFor("deposit.rejected")).toEqual([
      ["deposits"],
      ["grattage-invoices"],
      ["grattage-outstanding"],
    ]);
  });

  it("registers deposit.created — Deposits, plus Grattage Invoices and Grattage Outstanding (M6 Phase 2: a reconciliation deposit links invoices immediately, dropping the outstanding total)", () => {
    expect(queryKeyPrefixesFor("deposit.created")).toEqual([
      ["deposits"],
      ["grattage-invoices"],
      ["grattage-outstanding"],
    ]);
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

  it("registers bon.created — Bons' own key space only", () => {
    expect(queryKeyPrefixesFor("bon.created")).toEqual([["bons"]]);
  });

  it("registers bon.line-changed — Bons' own key space only", () => {
    expect(queryKeyPrefixesFor("bon.line-changed")).toEqual([["bons"]]);
  });

  it("registers bon.validated — no cross-domain prefix (writes only stock_movements/stocks)", () => {
    expect(queryKeyPrefixesFor("bon.validated")).toEqual([["bons"]]);
  });

  it("registers bon.cancelled — no cross-domain prefix (reverses stock plus the bon's own cancellation-audit columns only)", () => {
    expect(queryKeyPrefixesFor("bon.cancelled")).toEqual([["bons"]]);
  });

  it("registers grattage-invoice.cancelled — Grattage Invoices' own key space, plus Grattage Outstanding (M6 Phase 2: cancelling removes the invoice from both the outstanding and undischarged scopes)", () => {
    expect(queryKeyPrefixesFor("grattage-invoice.cancelled")).toEqual([
      ["grattage-invoices"],
      ["grattage-outstanding"],
    ]);
  });

  it("registers agent.blocked — Agents' own key space plus both Network list prefixes (M7 Phase 1: same block endpoint Managers/Commercials already call)", () => {
    expect(queryKeyPrefixesFor("agent.blocked")).toEqual([
      ["agents"],
      ["managers"],
      ["commercials"],
    ]);
  });

  it("registers agent.activated — the same three prefixes as agent.blocked", () => {
    expect(queryKeyPrefixesFor("agent.activated")).toEqual([
      ["agents"],
      ["managers"],
      ["commercials"],
    ]);
  });

  it("registers agent.updated — the same three prefixes (M7 Phase 1.5: same POST /admin/agents/{id} endpoint Managers'/Commercials' own edit drawers already call)", () => {
    expect(queryKeyPrefixesFor("agent.updated")).toEqual([
      ["agents"],
      ["managers"],
      ["commercials"],
    ]);
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
