/**
 * Staleness tiers (FTA §8).
 *
 * A single global staleTime is the standard advice and it is wrong here, because
 * the cost of stale data in this product ranges from *nothing* (a ville's name) to
 * *a wrongly-approved cheque*. Each tier's number is derived from what that data
 * costs when it is wrong — not from what feels responsive.
 *
 * A query MUST pick its tier deliberately. The QueryClient default is CRITICAL
 * (see query-client.ts): a query that forgets to choose gets the safe answer.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const STALE_TIMES = {
  /**
   * Reference data: villes, secteurs, products. Changes are rare and
   * administrative; these feed every form's pickers, so caching them hard removes
   * a request from nearly every screen. A ville renamed an hour late costs nothing.
   */
  STATIC: 1 * HOUR,

  /**
   * Network identity: agent and client lists and details. Changes during a working
   * day, but not during a task. Stale identity data is an annoyance, not a
   * financial error.
   */
  SLOW: 5 * MINUTE,

  /**
   * Financial queues and balances: pending cheques and deposits, agent capacity,
   * outstanding grattage, restock-gate state, Overview KPIs. Multiple admins work
   * these queues at once; showing a cheque as pending after a colleague approved it
   * produces duplicate work and a confusing 409.
   */
  LIVE: 15 * SECOND,

  /**
   * Anything read IN ORDER TO DECIDE an irreversible action: the record inside a
   * validate/approve confirmation, the capacity a submission will consume, the gate
   * state a form depends on. Always refetched — a confirmation dialog rendered from
   * stale cache is a lie told at the exact moment the operator trusts us most.
   */
  CRITICAL: 0,
} as const;

/** How long an unused cache entry survives before eviction. */
export const DEFAULT_GC_TIME = 5 * MINUTE;
