import { Link } from "react-router-dom";
import { ABSENT, formatIdentifier } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { agentDetailPath } from "@/domains/network/agents";
import type { ClientDetailCommercial } from "../model/client";

/**
 * Client 360 Phase 2 — the current Commercial relationship section.
 *
 * SOURCE OF TRUTH IS `ClientDetail.commercial` ALONE — never derived from
 * assignment history (`ClientAssignmentHistory`'s own model docblock: "this
 * table is NEVER read to derive current ownership"). This component takes
 * no history prop and imports nothing from the history panel/query — the
 * two are deliberately independent, enforced by the type signature itself,
 * not just convention.
 *
 * DEEP LINK REUSES `agentDetailPath` FROM `@/domains/network/agents` — the
 * SAME public route helper `AgentWorkspacePage`'s own manager deep-link and
 * `ManagersListPage`'s own "View" button already use. Not reconstructed.
 *
 * THE LINK IS PERMISSION-AWARE, NOT UNCONDITIONAL: rendered as a real
 * `<Link>` only when the viewer holds `view-agents` (the permission
 * `CLIENT_DETAIL_PATH`'s own sibling route, `/network/agents/:id`, is
 * itself gated on) — without it, the SAME Commercial identity renders as
 * plain text. Never present a navigation affordance to a route the
 * operator cannot open; the caller passes `canViewAgents` down rather than
 * this component re-deriving it, keeping the permission check in ONE place
 * (`ClientWorkspacePage`).
 *
 * THE ASSIGN/REASSIGN ACTION IS GATED SEPARATELY (`canAssign`, i.e.
 * `assign-client`) — a session can view the relationship without being able
 * to change it, and vice versa is never true (verified from the permission
 * matrix, Phase 2 discovery §3): the button is simply omitted when absent,
 * not disabled-with-a-tooltip — the same "omit, don't disable" convention
 * every other permission-gated action in this product already follows.
 */
type ClientCommercialSectionProps = {
  commercial: ClientDetailCommercial | null;
  canViewAgents: boolean;
  canAssign: boolean;
  onReassign: () => void;
};

export function ClientCommercialSection({
  commercial,
  canViewAgents,
  canAssign,
  onReassign,
}: ClientCommercialSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Commercial</h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Assigned to</dt>
          <dd className="text-sm">
            {commercial ? (
              canViewAgents ? (
                <Link
                  to={agentDetailPath(commercial.id)}
                  className="text-primary underline underline-offset-4"
                >
                  {commercial.prenom} {commercial.nom}
                </Link>
              ) : (
                `${commercial.prenom} ${commercial.nom}`
              )
            ) : (
              ABSENT
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Account number</dt>
          <dd className="text-sm">
            {commercial ? formatIdentifier(commercial.numCompte) : ABSENT}
          </dd>
        </div>
      </dl>
      {canAssign ? (
        <div>
          <Button variant="outline" size="sm" onClick={onReassign}>
            {commercial ? "Reassign Commercial" : "Assign Commercial"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
