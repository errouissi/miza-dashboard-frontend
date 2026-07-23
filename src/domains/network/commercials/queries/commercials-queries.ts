import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  activateCommercial,
  blockCommercial,
  updateCommercial,
  fetchCommercials,
  fetchCommercialOptions,
  type UpdateCommercialInput,
} from "../api/commercials-api";
import type { CommercialListParams } from "../model/commercial";
import { commercialsKeys } from "./keys";

/**
 * Commercials data hooks (FTA §8).
 *
 * SLOW tier, per ADR-0007 — identical reasoning to Managers: commercials are
 * network identity carrying an account status, not reference data.
 */
export function useCommercialsQuery(params: CommercialListParams) {
  return useQuery({
    queryKey: commercialsKeys.list(params),
    queryFn: () => fetchCommercials(params),
    staleTime: STALE_TIMES.SLOW,
  });
}

/**
 * The commercial set for relation pickers (M3.5). Same SLOW tier as the list
 * itself — a commercial's name and status are part of the identity record the
 * tier already covers, not reference data. `enabled` lets the caller gate this
 * on `view-agents` — a DIFFERENT permission from whatever gates the caller's
 * own screen (mirrors `useVilleOptionsQuery`'s `enabled` parameter, not
 * `useManagerOptionsQuery`'s unconditional fetch — Commercials' manager filter
 * needed no gate because both endpoints share `view-agents`; Clients' own
 * permission set does not include it).
 */
export function useCommercialOptionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: commercialsKeys.options(),
    queryFn: fetchCommercialOptions,
    staleTime: STALE_TIMES.SLOW,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Every mutation reshapes the list, so all of them invalidate the WHOLE key
 * space — `all`, not just `lists()`, now that a sibling key space
 * (`options()`) actually exists here too (mirrors `useInvalidateManagers`'
 * identical reasoning). Invalidating only `lists()` would leave a newly
 * blocked commercial showing as a valid bulk-assign target in Clients' picker
 * until SLOW's staleTime elapsed. No optimistic updates and no automatic
 * retries (FTA D-7, §11): a status change that appears to succeed and then
 * silently reverts is worse than a slow one.
 */
function useInvalidateCommercials() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
}

export function useUpdateCommercialMutation() {
  const invalidate = useInvalidateCommercials();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCommercialInput & { id: number }) =>
      updateCommercial(id, input),
    onSuccess: invalidate,
  });
}

export function useBlockCommercialMutation() {
  const invalidate = useInvalidateCommercials();
  return useMutation({
    mutationFn: (id: number) => blockCommercial(id),
    onSuccess: invalidate,
  });
}

export function useActivateCommercialMutation() {
  const invalidate = useInvalidateCommercials();
  return useMutation({
    mutationFn: (id: number) => activateCommercial(id),
    onSuccess: invalidate,
  });
}
