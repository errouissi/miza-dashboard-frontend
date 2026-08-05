import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchSupplierOptions } from "../api/suppliers-api";
import { suppliersKeys } from "./keys";

/**
 * Suppliers data hooks (FTA §8). `STATIC` TIER — mirrors
 * `useCompanyOptionsQuery` exactly: seeded reference data expected to stay
 * stable (`Phase4ASeeder`), not an identity record carrying an
 * account-status field.
 *
 * `enabled` (default `true`) mirrors `useCompanyOptionsQuery`'s own
 * pattern — the endpoint is gated `access-dashboard` server-side; Bon's
 * own create form is gated `create-bon`, a DIFFERENT permission (same
 * known, undocumented-fix gap Companies' own query already carries).
 */
export function useSupplierOptionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: suppliersKeys.options(),
    queryFn: fetchSupplierOptions,
    staleTime: STALE_TIMES.STATIC,
    enabled: options?.enabled ?? true,
  });
}
