import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  activateManager,
  blockManager,
  updateManager,
  fetchManagers,
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
 * Every mutation reshapes the list, so all of them invalidate the LIST space.
 *
 * `lists()` rather than `all` — there is no sibling key space in this domain today,
 * but scoping the invalidation to what actually changed keeps it correct when there
 * is one. No optimistic updates and no automatic retries (FTA D-7, §11): a status
 * change that appears to succeed and then silently reverts is worse than a slow one.
 */
function useInvalidateManagers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: managersKeys.lists() });
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
