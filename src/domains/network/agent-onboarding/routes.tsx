import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentOnboardingWizardPage } from "./pages/agent-onboarding-wizard-page";

/**
 * Agent onboarding route contribution (FTA §5).
 *
 * Gated on `create-agent` — its own permission, distinct from `view-agents`
 * (Managers'/Commercials' own route gate). NO CHILDREN, matching every
 * other M3 route: a flat contribution, so `withPermissionGuards`' shallow
 * design (FE-2) is not implicated here.
 *
 * NO NAV ENTRY, by decision: this route is reached only via the "Create
 * Manager"/"Create Commercial" buttons on Managers'/Commercials' own list
 * pages (`?role=manager` / `?role=commercial`), not a sidebar item.
 */
export const AGENT_ONBOARDING_PATH = "/network/agents/onboard";

export const agentOnboardingRoutes: RouteObject[] = [
  {
    path: AGENT_ONBOARDING_PATH,
    element: <AgentOnboardingWizardPage />,
    handle: {
      permission: PERMISSIONS.CREATE_AGENT,
      breadcrumb: "Onboard agent",
    },
  },
];
