import type { DepositListParams } from "../model/deposit";

/**
 * The Deposits query-key factory (FTA §8) — FLAT, matching `chequesKeys`'s
 * own already-established deviation from FTA §8's `[domain,resource,...]`
 * prose (`queries/keys.ts` in `money/cheques` carries the full reasoning;
 * not re-derived here, the same convention applies).
 */
export const depositsKeys = {
  all: ["deposits"] as const,
  lists: () => [...depositsKeys.all, "list"] as const,
  list: (params: DepositListParams) => [...depositsKeys.lists(), params] as const,
  details: () => [...depositsKeys.all, "detail"] as const,
  detail: (id: number) => [...depositsKeys.details(), id] as const,
};
