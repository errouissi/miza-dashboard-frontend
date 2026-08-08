/**
 * The Grattage Outstanding query-key factory (FTA §8) — FLAT, matching
 * every other Grattage/Money/Stock resource's own established deviation
 * from FTA §8's `[domain,resource,...]` prose.
 *
 * ONE KEY, SHARED BY BOTH `useGrattageOutstandingQuery` (private, full
 * read) AND `useGrattageRestockGateQuery` (public, narrow `select`
 * projection) — deliberate: both read the exact same underlying resource,
 * so one cache entry serves either caller, and mounting both for the same
 * agent (a future Agent 360 panel alongside a Stock form, say) never
 * double-fetches.
 */
export const grattageOutstandingKeys = {
  all: ["grattage-outstanding"] as const,
  detail: (agentId: number) => [...grattageOutstandingKeys.all, agentId] as const,
};
