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
