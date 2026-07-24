export { AGENT_ONBOARDING_PATH, agentOnboardingRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. Managers'
// and Commercials' own list pages need only the path above, to link their
// "Create Manager"/"Create Commercial" buttons at `?role=...` — nothing
// else is exported (FTA §4). This domain exports no picker of its own;
// nothing has needed one.
