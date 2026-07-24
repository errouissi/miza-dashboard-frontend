import { useMutation } from "@tanstack/react-query";
import { createAgent } from "../api/agent-onboarding-api";
import type { AgentOnboardingFormValues } from "../model/agent-onboarding";

/**
 * The one mutation this domain owns. No optimistic update, no automatic
 * retry (FTA D-7, §11) — an agent creation that appears to succeed and then
 * silently reverts is worse than a slow one, and it is genuinely
 * irreversible (real credentials, real uploaded documents).
 *
 * DELIBERATELY INVALIDATES NOTHING in Managers'/Commercials' query-key
 * spaces. Neither domain exports its `managersKeys`/`commercialsKeys`
 * factory (only a picker, `useManagerOptionsQuery`/`useCommercialOptionsQuery`)
 * — importing them here to invalidate would mean reaching past a domain's
 * public surface, which ADR-0012's ownership boundary exists to prevent. A
 * newly onboarded agent appears in the Managers/Commercials list once
 * `STALE_TIMES.SLOW` elapses or the operator refreshes — an accepted,
 * documented limitation of keeping this domain genuinely independent, not
 * an oversight.
 */
export function useCreateAgentMutation() {
  return useMutation({
    mutationFn: (values: AgentOnboardingFormValues) => createAgent(values),
  });
}
