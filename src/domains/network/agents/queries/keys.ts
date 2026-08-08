/**
 * The Agents query-key factory (FTA §8) — FLAT, matching every other
 * domain's own already-established deviation from FTA §8's `[domain,
 * resource,...]` prose.
 */
export const agentsKeys = {
  all: ["agents"] as const,
  details: () => [...agentsKeys.all, "detail"] as const,
  detail: (id: number) => [...agentsKeys.details(), id] as const,
};

/**
 * A SEPARATE, FLAT top-level key space — not nested under `agentsKeys.all`
 * (M7 Agent 360 completion item). Deliberately: the stock-quantity read is a
 * genuinely different resource (a `LIVE`-tier business guard, re-verified
 * on every meaningful stock-changing event) from the `SLOW`-tier identity
 * read `agentsKeys.detail` serves. Nesting it under `agentsKeys.all` would
 * make every `"agent.updated"`/`"agent.blocked"`/`"agent.activated"` event
 * over-invalidate this LIVE read for no reason, and would make this read's
 * own targeted invalidations (agent-transfer/agent-stock-return validation,
 * grattage-invoice cancellation) bust the unrelated SLOW identity cache too.
 * Mirrors `grattageOutstandingKeys`' own identical reasoning for staying a
 * separate flat key space alongside `agentsKeys`.
 */
export const commercialStockQuantityKeys = {
  all: ["commercial-stock-quantity"] as const,
  detail: (agentId: number) => [...commercialStockQuantityKeys.all, agentId] as const,
};
