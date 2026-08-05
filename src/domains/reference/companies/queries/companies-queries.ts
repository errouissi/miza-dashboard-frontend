import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchCompanyOptions } from "../api/companies-api";
import { companiesKeys } from "./keys";

/**
 * Companies data hooks (FTA §8).
 *
 * `STATIC` TIER, same reasoning as Villes/Secteurs/Products: seeded
 * reference data expected to stay stable (`Phase4ASeeder`), not an identity
 * record carrying an account-status field. A rename seen an hour late costs
 * nothing.
 *
 * `enabled` (default `true`) mirrors `useVilleOptionsQuery`'s own pattern —
 * for a caller mounted regardless of permission (e.g. a form drawer whose
 * `children` render whether or not the drawer is open). The endpoint is
 * gated `access-dashboard` server-side; Allocations' own create form is
 * gated `create-allocation`, a DIFFERENT permission (same known,
 * undocumented-fix gap M3.6's own manager picker already carries — a
 * session holding `create-allocation` without `access-dashboard` would 403
 * on this specific query, not on the page itself).
 */
export function useCompanyOptionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: companiesKeys.options(),
    queryFn: fetchCompanyOptions,
    staleTime: STALE_TIMES.STATIC,
    enabled: options?.enabled ?? true,
  });
}
