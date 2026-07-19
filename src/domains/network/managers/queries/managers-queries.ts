import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  activateManager,
  blockManager,
  updateManager,
  fetchManagers,
  fetchManagerOptions,
  type UpdateManagerInput,
} from "../api/managers-api";
import type { ManagerListParams } from "../model/manager";
import { managersKeys } from "./keys";

/**
 * Managers data hooks (FTA §8).
 *
 * SLOW tier, per ADR-0007: managers are network identity carrying an account
 * status, not reference data. A manager shown as active five minutes after a
 * colleague blocked them is an annoyance rather than a financial error — SLOW's
 * own words — whereas STATIC's justification ("a stale name costs nothing") does
 * not hold for a status field.
 */
export function useManagersQuery(params: ManagerListParams) {
  return useQuery({
    queryKey: managersKeys.list(params),
    queryFn: () => fetchManagers(params),
    staleTime: STALE_TIMES.SLOW,
  });
}

/**
 * The manager set for relation pickers (M3.3). Same SLOW tier as the list
 * itself — a manager's name is part of the identity record the tier already
 * covers, not reference data.
 */
export function useManagerOptionsQuery() {
  return useQuery({
    queryKey: managersKeys.options(),
    queryFn: fetchManagerOptions,
    staleTime: STALE_TIMES.SLOW,
  });
}

/**
 * Every mutation reshapes the list, so all of them invalidate the WHOLE key
 * space — `all`, not just `lists()`. The picker set (`options()`) holds the
 * same rows under a different shape; invalidating only the list would leave a
 * renamed or re-blocked manager showing stale in Commercials' manager filter
 * until SLOW's staleTime elapsed (mirrors `useInvalidateVilles`' identical
 * reasoning, now that a sibling key space actually exists here too). No
 * optimistic updates and no automatic retries (FTA D-7, §11): a status change
 * that appears to succeed and then silently reverts is worse than a slow one.
 */
function useInvalidateManagers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: managersKeys.all });
}

export function useUpdateManagerMutation() {
  const invalidate = useInvalidateManagers();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateManagerInput & { id: number }) =>
      updateManager(id, input),
    onSuccess: invalidate,
  });
}

export function useBlockManagerMutation() {
  const invalidate = useInvalidateManagers();
  return useMutation({
    mutationFn: (id: number) => blockManager(id),
    onSuccess: invalidate,
  });
}

export function useActivateManagerMutation() {
  const invalidate = useInvalidateManagers();
  return useMutation({
    mutationFn: (id: number) => activateManager(id),
    onSuccess: invalidate,
  });
}
