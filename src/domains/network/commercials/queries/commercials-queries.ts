import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  activateCommercial,
  blockCommercial,
  updateCommercial,
  fetchCommercials,
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
 * Every mutation reshapes the list, so all of them invalidate the LIST space.
 * `lists()`, not `all` — this domain exports no picker of its own yet, so
 * there is no sibling key space to keep in sync (unlike `managersKeys`, which
 * gained one this milestone). No optimistic updates and no automatic retries
 * (FTA D-7, §11): a status change that appears to succeed and then silently
 * reverts is worse than a slow one.
 */
function useInvalidateCommercials() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: commercialsKeys.lists() });
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
