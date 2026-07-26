import type { DebtPaymentListParams } from "../model/debt-payment";

/**
 * The Debt Payments query-key factory (FTA §8) — FLAT, matching
 * `chequesKeys`'/`depositsKeys`' own already-established deviation from FTA
 * §8's `[domain,resource,...]` prose (each domain's own `keys.ts` carries
 * the full reasoning; not re-derived here, the same convention applies).
 */
export const debtPaymentsKeys = {
  all: ["debt-payments"] as const,
  lists: () => [...debtPaymentsKeys.all, "list"] as const,
  list: (params: DebtPaymentListParams) => [...debtPaymentsKeys.lists(), params] as const,
};
