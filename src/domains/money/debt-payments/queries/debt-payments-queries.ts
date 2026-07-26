import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import { fetchDebtPayments, submitDebtPayment } from "../api/debt-payments-api";
import type { DebtPaymentListParams } from "../model/debt-payment";
import type { CreateDebtPaymentFormValues } from "../model/create-debt-payment";
import { debtPaymentsKeys } from "./keys";

/**
 * Debt Payments data hooks (FTA §8) — `LIVE` tier, `refetchOnWindowFocus:
 * true`, same as every other Money list/mutation pair. This is a
 * self-scoped screen (`index()` hard-scopes to `Auth::user()` — see
 * `model/debt-payment.ts`'s own docblock), so there is only ever one
 * "list" query per session, never one per viewed record the way
 * `useChequeQuery`/`useDepositQuery` exist for a detail page — there is no
 * detail page here (backend route commented out).
 */
export function useDebtPaymentsQuery(params: DebtPaymentListParams) {
  return useQuery({
    queryKey: debtPaymentsKeys.list(params),
    queryFn: () => fetchDebtPayments(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * Submit (record) a debt payment — `POST /admin/debt-payments`.
 *
 * Invalidates via `"debt-payment.created"` — `["debt-payments"]` ONLY. The
 * balance column this write touches (`User.debt`) is rendered nowhere in
 * Network (Managers'/Commercials' own `avanceTotal` reads
 * `montant_avance_*`, never `debt`) — re-verified from source this phase,
 * not assumed by analogy to Cheques'/Deposits' own cross-domain
 * invalidation entries.
 *
 * No optimistic update, no automatic retry (FTA D-7, §11) — same
 * financial-workflow discipline as every other Money mutation.
 */
export function useCreateDebtPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateDebtPaymentFormValues) => submitDebtPayment(values),
    onSuccess: () => invalidateForEvent(queryClient, "debt-payment.created"),
  });
}
