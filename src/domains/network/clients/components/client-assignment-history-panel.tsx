import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDateTime } from "@/shared/formatters";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { agentDetailPath } from "@/domains/network/agents";
import { useClientAssignmentHistoryQuery } from "../queries/clients-queries";
import type {
  ClientAssignmentHistoryActor,
  ClientAssignmentHistoryCommercial,
  ClientAssignmentHistoryEntry,
} from "../model/client";

/**
 * Client 360 Phase 2's Assignment History panel — an OPERATIONAL panel
 * (audit read, not identity), composed independently of the Profile/Edit/
 * current-Commercial sections above it. A render crash, query error, or
 * empty result here must never blank the rest of the workspace — this is
 * the SECOND real panel Client 360 gets (the first being this one; the
 * Commercial relationship section is identity-adjacent, not a panel), so
 * unlike Phase 1's own deferral of `PanelBoundary` (nothing to isolate FROM
 * yet), this is exactly the phase that earns it — mirrored from
 * `ClientWorkspacePage`'s own caller, not owned here.
 *
 * PERMISSION: gated on `view-clients` — the SAME permission
 * `assignmentHistory()` itself carries (no dedicated history permission
 * exists, confirmed from `routes/api.php`) — `enabled` on the underlying
 * query, mirroring `AgentOutstandingPanel`'s own "`if (!canView) return
 * null`" discipline: no unauthorized request, and nothing rendered for a
 * session that cannot reach `GET /admin/clients/{id}/assignment-history`
 * at all (though in practice this permission is already required to reach
 * this page — this is the same belt-and-suspenders re-check every other
 * panel in this product already applies).
 *
 * COMMERCIAL NAMES ARE PERMISSION-AWARE LINKS, THE SAME RULE
 * `ClientCommercialSection` USES — `view-agents`, checked independently of
 * `view-clients` (which gates this panel's own visibility). Reuses
 * `agentDetailPath`, never reconstructed.
 *
 * NEVER FABRICATES A LEGACY ROW: an empty `items` array (a Client whose
 * ownership has never changed since backend commit `7066ffa`, or one that
 * predates it entirely — confirmed no-backfill) renders the honest "No
 * recorded history yet" empty state, never a synthesized "assigned since
 * X" entry derived from `ClientDetail.commercial`.
 *
 * TRUNCATION IS DISCLOSED, NEVER HIDDEN: `total` always comes from the
 * paginator, independent of how many rows this compact read actually
 * fetches (`CLIENT_ASSIGNMENT_HISTORY_PAGE_SIZE`) — when `total` exceeds
 * `items.length`, a plain "Showing latest N of TOTAL" line says so. No
 * "Load more" exists yet (Phase 2 discovery decision) and none is
 * implemented here as a side effect.
 */
type ClientAssignmentHistoryPanelProps = {
  clientId: number;
};

export function ClientAssignmentHistoryPanel({
  clientId,
}: ClientAssignmentHistoryPanelProps) {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.VIEW_CLIENTS);
  const canViewAgents = has(PERMISSIONS.VIEW_AGENTS);
  const query = useClientAssignmentHistoryQuery(clientId, { enabled: canView });

  if (!canView) return null;

  const errorReference = isAppError(query.error)
    ? resolveErrorDisplay(query.error).requestId
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Assignment history</h2>
      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState
          message="Assignment history could not be loaded."
          reference={errorReference}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <ListEmptyState>No recorded history yet.</ListEmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {query.data.items.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} canViewAgents={canViewAgents} />
            ))}
          </ul>
          {query.data.total > query.data.items.length ? (
            <p className="text-muted-foreground text-xs">
              Showing latest {query.data.items.length} of {query.data.total}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function CommercialName({
  commercial,
  canViewAgents,
}: {
  commercial: ClientAssignmentHistoryCommercial;
  canViewAgents: boolean;
}) {
  const name = `${commercial.prenom} ${commercial.nom}`;
  return canViewAgents ? (
    <Link
      to={agentDetailPath(commercial.id)}
      className="text-primary underline underline-offset-4"
    >
      {name}
    </Link>
  ) : (
    <>{name}</>
  );
}

function historySummary(
  entry: ClientAssignmentHistoryEntry,
  canViewAgents: boolean,
): { message: ReactNode } {
  const from = entry.fromCommercial ? (
    <CommercialName commercial={entry.fromCommercial} canViewAgents={canViewAgents} />
  ) : null;
  const to = entry.toCommercial ? (
    <CommercialName commercial={entry.toCommercial} canViewAgents={canViewAgents} />
  ) : null;

  switch (entry.type) {
    case "assigned":
      return { message: <>Assigned to {to}</> };
    case "reassigned":
      return {
        message: (
          <>
            Reassigned from {from} to {to}
          </>
        ),
      };
    case "unassigned":
      return { message: <>Unassigned from {from}</> };
  }
}

/** `null` renders "System" — the defensive fallback for a transition with no distinguishable actor (no live backend path produces this today). */
function actorName(actor: ClientAssignmentHistoryActor): string {
  if (actor === null) return "System";
  if (actor.kind === "user") return actor.name;
  return `${actor.prenom} ${actor.nom}`;
}

function HistoryRow({
  entry,
  canViewAgents,
}: {
  entry: ClientAssignmentHistoryEntry;
  canViewAgents: boolean;
}) {
  const { message } = historySummary(entry, canViewAgents);
  return (
    <li className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0">
      <p className="text-sm">{message}</p>
      <p className="text-muted-foreground text-xs">
        {actorName(entry.actor)} · {formatDateTime(entry.changedAt)}
      </p>
    </li>
  );
}
