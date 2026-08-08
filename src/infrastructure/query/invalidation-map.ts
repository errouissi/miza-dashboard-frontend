import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * The cross-domain cache invalidation map (FTA §4, §8 — D-3).
 *
 * A mutation whose effects the backend propagates across domains does NOT
 * import the other domain's query keys and invalidate them directly — that
 * quietly makes the mutating domain depend on every domain it ever affects,
 * and the coupling stays invisible (nothing lists which mutations touch
 * which caches). Instead, the mutation announces a named DOMAIN EVENT (e.g.
 * `cheque.approved`) and knows nothing else. This ONE file declares which
 * query-key prefixes, across every domain, each event invalidates — the
 * single, greppable answer to "what happens when a cheque is approved?".
 *
 * ENTRIES SHIPPED EMPTY AT M4.1 — Money, the first domain to emit a real
 * event, was not built yet. `cheque.created` (M4.2 Phase 3A) is the FIRST
 * real entry: registered from a real mutation (`useCreateChequeMutation`),
 * not ahead of one (`session-bootstrap.md`'s own rule). `cheque.approved`/
 * `cheque.rejected`/`cheque.annuled` (M4.2 Phase 3C) are now registered too,
 * from `useApproveChequeMutation`/`useRejectChequeMutation`/
 * `useAnnulerChequeMutation` — see each entry below for why it invalidates
 * what it does. `deposit.validated`/`deposit.rejected` (M4.3 Phase 3) are
 * the first Deposits entries, from `useValidateDepositMutation`/
 * `useRejectDepositMutation`.
 *
 * The mechanism, the fallback, and its test shipped at M4.1 — mirrors
 * `infrastructure/errors/error-code-registry.ts` exactly: an empty, frozen
 * registry, a lookup that degrades safely (an unregistered event
 * invalidates nothing rather than throwing), populated per event as real
 * mutations arrive, never ahead of them.
 */

/**
 * A domain event name, e.g. `"cheque.approved"`. Kept as a plain `string`
 * rather than a literal union — this registry is infrastructure and may
 * not import a domain's own event-name constants (the dependency direction
 * is `app -> domains -> shared -> infrastructure`, never the reverse), so
 * there is no domain-owned union type it could narrow to without inverting
 * that rule.
 */
export type DomainEvent = string;

/**
 * event -> the query-key PREFIXES it invalidates, across every domain that
 * cares. A prefix, not a full key: invalidating `['network','managers']`
 * refreshes every Managers view at once (list, and any future detail),
 * exactly as invalidating a resource's own key space already does today.
 *
 * `["cheques"]` is a LITERAL, not an import of `chequesKeys.all` — this
 * file cannot import a domain's key factory (same dependency-direction
 * reason `DomainEvent` stays a plain `string`, above). It is the flat shape
 * Cheques' own factory actually uses (`queries/keys.ts`'s own docblock
 * flags the same discrepancy with FTA §8's `[domain,resource,...]` prose) —
 * keep the two in sync by hand if that key's shape ever changes.
 */
const INVALIDATION_MAP: Readonly<Record<DomainEvent, readonly QueryKey[]>> =
  Object.freeze({
    "cheque.created": [["cheques"]],
    /**
     * Approving a cheque writes `agent.montant_avance_rapped` and/or
     * `agent.montant_avance_grattage`, and (for a `rapped` allocation)
     * `agent.solde` too (`ChequeController::approve`, verified from
     * source). Both Managers' and Commercials' own lists render
     * `avanceTotal`, computed from those same columns — invalidating BOTH
     * flat prefixes, not just the one matching the cheque's actual agent
     * role, is deliberate: which role a given `agent_id` holds is not known
     * without an extra read, and over-invalidating a cheap `SLOW`-tier list
     * is far safer than under-invalidating a balance an operator is about
     * to act on.
     */
    "cheque.approved": [["cheques"], ["managers"], ["commercials"]],
    /**
     * Annuler REVERSES the same columns `approve` wrote (per-allocation, or
     * a 100%-rapped legacy fallback) — same two Network prefixes as
     * `cheque.approved`, same reasoning.
     */
    "cheque.annuled": [["cheques"], ["managers"], ["commercials"]],
    /**
     * Reject touches NO balance column at all (verified from source,
     * `ChequeController::reject` — `montant_avance` explicitly stays
     * unchanged) — only Cheques' own key space needs busting.
     */
    "cheque.rejected": [["cheques"]],
    /**
     * Validating a deposit NEVER touches `agent.montant_avance_rapped`/
     * `montant_avance_grattage` — verified from source
     * (`DepoController::validateDepo`, `DepositService::validate`): the
     * rapped path writes `agent.solde`/`agent.cash` only; the grattage path
     * only flips `GrattageInvoice` rows to `settled`. Managers'/
     * Commercials' own `avanceTotal` is computed EXCLUSIVELY from
     * `montant_avance_*` (confirmed by reading both domains' own API
     * mappers — neither reads `solde`/`cash` anywhere), so neither is
     * affected. Unlike `cheque.approved`, NO Network prefix is invalidated
     * here — a genuine difference in what the two actions touch, not an
     * oversight.
     *
     * M6 Phase 2 UPDATE — re-verified from source (`DepositService
     * ::validate`): for a `type=grattage` deposit, every invoice linked to
     * it (`deposit_id` = this deposit) flips `pending|overdue -> settled`
     * in the SAME transaction. That changes the Grattage Invoices list/
     * detail's own `status` field AND clears the affected agent's
     * `restock_gate` (an invoice leaving `GrattageInvoice::undischarged()`
     * is exactly what reopens it — see `model/grattage-outstanding.ts`'s
     * own docblock). Both prefixes are busted regardless of the deposit's
     * actual `type` (a `rapped` validation is a harmless no-op bust on
     * both — cheap `LIVE`-tier reads, over-invalidating is the safer
     * default this codebase already applies elsewhere).
     */
    "deposit.validated": [["deposits"], ["grattage-invoices"], ["grattage-outstanding"]],
    /**
     * M6 Phase 2 UPDATE — re-verified from source (`DepositService
     * ::reject`): for a `type=grattage` deposit, every invoice linked to
     * it is UNLINKED (`deposit_id -> NULL`, status untouched). That
     * re-enables Cancel on those invoices (the Phase 1 `deposit_id !==
     * null` freeze guard) AND raises the affected agent's
     * `summary.requiredTotal` back up (re-entering
     * `GrattageInvoice::outstanding()`) — `restock_gate` is UNAFFECTED
     * (it was never gated by `deposit_id` in the first place). Both
     * prefixes are busted regardless of `type`, same reasoning as
     * `deposit.validated` above.
     */
    "deposit.rejected": [["deposits"], ["grattage-invoices"], ["grattage-outstanding"]],
    /**
     * M6 Phase 2 UPDATE — re-verified from source
     * (`DepositService::createGrattageReconciliation`): for a
     * `type=grattage` deposit, EVERY currently-outstanding invoice for
     * that agent is linked (`deposit_id` set) THE INSTANT THE DEPOSIT IS
     * CREATED, before any validation. This changes those invoices'
     * `depositId` (the Phase 1 cancel-freeze guard) AND drops the agent's
     * `summary.requiredTotal` to exclude them immediately —
     * `restock_gate` is UNAFFECTED at this step (stays blocked; only
     * `validate()` clears it, per decision #8a). The legacy
     * rapped+cash-method side effect (`currentAdmin->debt`) touches
     * `User.debt`, a column no Network list renders (re-verified from
     * source this phase, `DepoController::store`). Both new prefixes are
     * busted regardless of `type`, same reasoning as above.
     */
    "deposit.created": [["deposits"], ["grattage-invoices"], ["grattage-outstanding"]],
    /**
     * Recording a debt payment writes `User.debt` only (`DebtPaymentController
     * ::store`) — a column no Network list renders (Managers'/Commercials'
     * own `avanceTotal` reads `montant_avance_*`, never `debt`). Only
     * Debt Payments' own key space needs busting.
     */
    "debt-payment.created": [["debt-payments"]],
    /**
     * Agent Stock Returns (roadmap M5, Phase 1 — the first Stock resource).
     * A draft touches no balance and no stock row — materialization only
     * happens at validate time. `["agent-stock-returns"]` only.
     */
    "agent-stock-return.created": [["agent-stock-returns"]],
    /**
     * Any of the three line mutations (add/update/remove) recomputes the
     * parent's `montant` — the same key space, no cross-domain effect.
     */
    "agent-stock-return.line-changed": [["agent-stock-returns"]],
    /**
     * Validating materializes stock movements (commercial debited, manager
     * credited) — but NO frontend query anywhere reads a stock quantity
     * yet (no `StockController`, verified from source this phase, and no
     * consumer in this codebase). `["agent-stock-returns"]` only; revisit
     * once a Stock ledger view or the Grattage restock-gate hook (both M6)
     * exist.
     */
    "agent-stock-return.validated": [["agent-stock-returns"]],
    /**
     * Agent Transfers (roadmap M5, Phase 2). A draft touches no balance
     * and no stock row — materialization only happens at validate time.
     * `["agent-transfers"]` only.
     */
    "agent-transfer.created": [["agent-transfers"]],
    /**
     * Any of the three line mutations (add/update/remove) recomputes the
     * parent's `montant` — the same key space, no cross-domain effect.
     */
    "agent-transfer.line-changed": [["agent-transfers"]],
    /**
     * Validating writes ONLY `stocks`/`stock_movements` rows (re-verified
     * from source this phase, `StockService::validateTransfer` Step 8) —
     * NOT `Agent.montant_avance_grattage` or any other balance column
     * Managers'/Commercials' own lists render. `["agent-transfers"]` only;
     * revisit once a Stock ledger view or the Grattage restock-gate hook
     * (both M6) exist.
     */
    "agent-transfer.validated": [["agent-transfers"]],
    /**
     * Allocations (roadmap M5, Phase 4). A draft touches no balance, no
     * stock row and no deposit — materialization and deposit consumption
     * both happen only at validate time. `["allocations"]` only.
     */
    "allocation.created": [["allocations"]],
    /**
     * Any of the three line mutations (add/update/remove) recomputes the
     * parent's `montant` — the same key space, no cross-domain effect.
     */
    "allocation.line-changed": [["allocations"]],
    /**
     * Validating writes `stocks`/`stock_movements`/
     * `allocation_deposit_consumptions` rows (re-verified from source this
     * phase, `StockService::validateAllocation`) — it READS but never
     * WRITES `Agent.montant_avance_grattage`, and Deposits' own `amount`/
     * `status` columns are untouched (the ADC table is a separate audit
     * trail, append-only). No Network or Deposits list renders a column
     * this mutation changes. `["allocations"]` only; revisit once a Stock
     * ledger view or the Grattage restock-gate hook (both M6) exist.
     */
    "allocation.validated": [["allocations"]],
    /**
     * Bons (roadmap M5, Phase 5 — the fifth and final Stock resource). A
     * draft touches no stock row — materialization only happens at
     * validate time. `["bons"]` only.
     */
    "bon.created": [["bons"]],
    /**
     * Any of the three line mutations (add/update/remove) — `bons.montant`
     * is metadata-only, so unlike Allocation's own line-changed event
     * there is no recomputed aggregate for the list to reflect, but the
     * key space still needs busting so the detail page's own lines table
     * refreshes. `["bons"]` only.
     */
    "bon.line-changed": [["bons"]],
    /**
     * Validating writes only `stock_movements`/`stocks` rows (re-verified
     * from source this phase, `StockService::validateBon`) — no Network
     * or Money list renders a column this mutation changes. `["bons"]`
     * only.
     */
    "bon.validated": [["bons"]],
    /**
     * Cancelling reverses stock (`stock_movements`/`stocks`) and writes
     * the bon's own four cancellation-audit columns
     * (`status`/`cancelled_by`/`cancelled_at`/`cancellation_reason`) —
     * re-verified from source, `StockService::cancelBon`. No other
     * domain's own list renders any of these. `["bons"]` only.
     */
    "bon.cancelled": [["bons"]],
    /**
     * Grattage Invoices (roadmap M6, Phase 1 — the first Grattage
     * resource). Cancelling restores the commercial's stock via
     * `StockService::cancelSale` (`stock_movements`/`stocks` rows only,
     * re-verified from source) — no frontend query anywhere currently
     * reads a COMMERCIAL's own available stock reactively (Return's/Bons'
     * own "add line" pickers use the unfiltered product catalogue;
     * Allocations'/Transfers' own use company/manager-side stock, never
     * commercial-side), so there is no Stock cache to bust. No balance
     * column is touched either (grattage never writes
     * `solde`/`cash`/`dept`).
     *
     * M6 Phase 2 UPDATE — `["grattage-outstanding"]` added:
     * `isCancellable()` only permits cancelling a `deposit_id IS NULL`
     * invoice (Phase 1's own freeze guard), so a cancelled invoice was
     * ALWAYS in `GrattageInvoice::outstanding()` AND
     * `GrattageInvoice::undischarged()` the instant before its status
     * flipped — cancelling therefore removes it from BOTH scopes at once,
     * lowering `summary.requiredTotal` and potentially clearing
     * `restock_gate` for that agent (and, for a commercial, their
     * manager's own `TEAM_OUTSTANDING_GRATTAGE` gate too — re-verified
     * from `computeGrattageRestockGate`, which reads live, not from a
     * cached snapshot).
     */
    "grattage-invoice.cancelled": [["grattage-invoices"], ["grattage-outstanding"]],
    /**
     * Agents (roadmap M7, Phase 1 — the fifth Network resource, and the
     * first real consumer of `GET /admin/agents/{id}`). Block/Activate hit
     * the IDENTICAL `/admin/agents/{id}/block`/`.../activate` endpoints
     * `Manager`'s/`Commercial`'s own mutations already call — so a status
     * change made from the Agent 360 workspace must also refresh either
     * list, not just this domain's own cache. Which of `managers`/
     * `commercials` is the "right" one is not known without an extra read
     * (the workspace does not import either domain), so both are busted
     * regardless of the agent's actual role — the same over-invalidation
     * reasoning `cheque.approved` already established for a cheap
     * `SLOW`-tier list.
     */
    "agent.blocked": [["agents"], ["managers"], ["commercials"]],
    "agent.activated": [["agents"], ["managers"], ["commercials"]],
  });

/** The prefixes a given event invalidates, or an empty list for an unregistered one. */
export function queryKeyPrefixesFor(event: DomainEvent): readonly QueryKey[] {
  return INVALIDATION_MAP[event] ?? [];
}

/**
 * Invalidates every query-key prefix registered for `event`. A mutation's
 * `onSuccess` calls this once with the event it just caused — it does not
 * need to know, or list, which OTHER domains' caches that implies.
 *
 * An unregistered event invalidates nothing and does not throw, the same
 * "unhelpful but safe" degradation `error-code-registry.ts` uses — a typo
 * in an event name should not crash a successful mutation.
 */
export function invalidateForEvent(
  queryClient: QueryClient,
  event: DomainEvent,
): Promise<void[]> {
  return Promise.all(
    queryKeyPrefixesFor(event).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
