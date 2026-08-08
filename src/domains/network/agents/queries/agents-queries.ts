import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import { isAppError } from "@/infrastructure/errors";
import {
  activateAgent,
  blockAgent,
  fetchAgent,
  fetchCommercialStockQuantity,
  updateAgent,
  type UpdateAgentFiles,
  type UpdateAgentInput,
} from "../api/agents-api";
import { agentsKeys, commercialStockQuantityKeys } from "./keys";

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
 * The Zero-stock reassignment guard's own read (M7 Agent 360 completion
 * item) — `GET /admin/agents/{agent}/stock-quantity`, `access-dashboard`.
 *
 * `LIVE` TIER, NOT `SLOW` — this is a proactive UI hint gating an
 * irreversible business action (manager reassignment), the same category
 * `stale-times.ts`'s own docblock describes under `LIVE` ("the gate state a
 * form depends on"), and the exact tier `useGrattageRestockGateQuery`/
 * `useManagerStockQuery` already use for the identical kind of read
 * (a live capacity/gate check feeding a form, not a browsable list).
 * Re-verified against the backend's own posture: this read is explicitly
 * "informational only... not, and must not become, an authorization check"
 * (`AgentController::stockQuantity`'s own docblock) — `update()`'s atomic
 * guard remains the sole authority regardless of this cache's freshness.
 */
export function useCommercialStockQuantityQuery(
  agentId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: commercialStockQuantityKeys.detail(agentId),
    queryFn: () => fetchCommercialStockQuantity(agentId),
    staleTime: STALE_TIMES.LIVE,
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
 *
 * `onError` — THE ONE SOURCE-VERIFIED, NARROW REACTION TO A SPECIFIC ERROR
 * CODE IN THIS DOMAIN (M7 Agent 360 completion item): a `manager_id`
 * reassignment can genuinely race — the proactive `stock-quantity` read
 * said zero, but a concurrent stock credit landed before Save, so
 * `update()`'s own atomic guard correctly refuses with
 * `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`. That response means the
 * proactive read this operator is looking at is now KNOWN STALE, so it is
 * invalidated here — not spun into `invalidation-map.ts`'s own event
 * registry, which models confirmed successful state transitions, not a
 * conditional branch on one rejected mutation's error code; forcing this
 * into that abstraction would misrepresent what it is.
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
    onError: (error, variables) => {
      if (isAppError(error) && error.code === "COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN") {
        void queryClient.invalidateQueries({
          queryKey: commercialStockQuantityKeys.detail(variables.id),
        });
      }
    },
  });
}
