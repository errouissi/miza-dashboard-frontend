import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  activateAgent,
  blockAgent,
  fetchAgent,
  updateAgent,
  type UpdateAgentFiles,
  type UpdateAgentInput,
} from "../api/agents-api";
import { agentsKeys } from "./keys";

/**
 * Agent data hooks (FTA §8) — the fifth Network resource (roadmap M7,
 * Phase 1).
 *
 * `SLOW` TIER — `stale-times.ts`'s own docblock names "agent and client
 * lists and details" explicitly under this tier: identity data that
 * changes during a working day, not during a task. `enabled` guards a
 * malformed `:id` route param, the same pattern every prior detail query
 * already established.
 */
export function useAgentQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: agentsKeys.detail(id),
    queryFn: () => fetchAgent(id),
    staleTime: STALE_TIMES.SLOW,
    enabled: options.enabled ?? true,
  });
}

/**
 * Block/Activate — `PUT /admin/agents/{id}/block`/`.../activate`, the
 * identical endpoints `Manager`'s/`Commercial`'s own mutations call. Each
 * invalidates via its own domain event (`"agent.blocked"`/
 * `"agent.activated"`, registered in `invalidation-map.ts`): `["agents"]`
 * (this workspace's own cache) PLUS `["managers"]`/`["commercials"]` — an
 * operator blocking or activating from the workspace must see the change
 * reflected if they navigate back to either list, and which of the two
 * key spaces is the "right" one is not known without an extra read, so
 * both are busted (the identical over-invalidation reasoning
 * `cheque.approved` already established for a cheap `SLOW`-tier list). No
 * optimistic updates, no automatic retries (FTA D-7, §11).
 */
export function useBlockAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => blockAgent(id),
    onSuccess: () => invalidateForEvent(queryClient, "agent.blocked"),
  });
}

export function useActivateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateAgent(id),
    onSuccess: () => invalidateForEvent(queryClient, "agent.activated"),
  });
}

/**
 * Edit — `POST /admin/agents/{id}` (multipart), M7 Phase 1.5. Same
 * over-invalidation reasoning as Block/Activate above: `"agent.updated"`
 * busts `["agents"], ["managers"], ["commercials"]` regardless of which
 * list the agent's role actually belongs to. `status` is never part of
 * this mutation's input (owned by Block/Activate), so there is no ordering
 * concern between them. No optimistic update, no automatic retry (FTA D-7,
 * §11) — doubly true here, since a retried multipart submit risks
 * redundant file-storage churn on top of the usual double-write risk.
 */
export function useUpdateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      files,
    }: {
      id: number;
      input: UpdateAgentInput;
      files?: UpdateAgentFiles;
    }) => updateAgent(id, input, files),
    onSuccess: () => invalidateForEvent(queryClient, "agent.updated"),
  });
}
