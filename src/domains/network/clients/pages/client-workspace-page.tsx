import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { ABSENT, formatDate, formatPhone } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { PanelBoundary } from "@/shared/components/patterns/panel-boundary";
import { WorkspacePage } from "@/shared/components/patterns/workspace-page";
import { ClientAssignmentHistoryPanel } from "../components/client-assignment-history-panel";
import { ClientCommercialSection } from "../components/client-commercial-section";
import { ClientFormSheet } from "../components/client-form-sheet";
import { ClientGrattagePanel } from "../components/client-grattage-panel";
import { ClientReassignDrawer } from "../components/client-reassign-drawer";
import { ClientStatusDialog } from "../components/client-status-dialog";
import { useClientQuery } from "../queries/clients-queries";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_TONES } from "../model/client";

/**
 * Client 360 (roadmap M7, Phase 1) — the WorkspacePage for a Client,
 * `/network/clients/:id`, reached from the Clients list's own "View" row
 * action. Mirrors `AgentWorkspacePage`'s own shape (`domains/network/agents/
 * pages/agent-workspace-page.tsx`) — the SAME loading/error/not-found
 * structure, the SAME `WorkspacePage` primitive — but is NOT a copy of its
 * component-reuse decisions: Agent 360 gives Block/Activate and Edit their
 * OWN fresh, parallel implementations (`AgentStatusDialog`/
 * `AgentEditDrawer`), private to that domain, because Managers'/
 * Commercials' own dialogs are private to THEIR domains (ADR-0012). Clients
 * has no such split — `ClientFormSheet`/`ClientStatusDialog` already lived
 * in this one domain, shared by the list since M3.4 — so this workspace
 * REUSES them verbatim rather than forking a second implementation (an
 * explicit Client 360 Phase 1 decision; see each component's own docblock
 * for the structural-prop-typing that makes the reuse work).
 *
 * PHASE 1 WAS IDENTITY/PROFILE/EDIT/STATUS ONLY. PHASE 2 added the
 * Commercial relationship section, the Assign/Reassign action, and the
 * Assignment History panel. PHASE 3 (this update) adds the Grattage
 * purchase-history panel — the frozen requirement's final named Client 360
 * capability (`phase8-architecture.html` §6: "profile/assignment history
 * (Network) with purchase history via grattage invoices (Grattage)").
 * Client 360 is now feature-complete against that frozen scope.
 *
 * `ClientCommercialSection` READS `ClientDetail.commercial` DIRECTLY, NEVER
 * FROM HISTORY — the current-Commercial and assignment-history reads are
 * two independent queries/components; neither imports the other, and
 * `ClientCommercialSection`'s own prop type has no history field to
 * accidentally read (see its own docblock, and
 * `client-workspace-page.test.tsx`'s own regression test constructing a
 * detail/history mismatch on purpose to prove this).
 *
 * `PanelBoundary` WRAPS BOTH `ClientAssignmentHistoryPanel` (Phase 2) AND
 * `ClientGrattagePanel` (Phase 3) — two independent panels, two independent
 * boundaries, so one's failure (loading/error/retry/render crash) can never
 * blank the other, or Profile/Edit/Commercial/Reassign above them. The
 * Commercial relationship section is identity-adjacent (reads the SAME
 * `clientQuery` this page's own Profile section already does, not a second
 * query), so it is not itself panel-wrapped — only genuinely independent,
 * separately-queried sections are. `ClientGrattagePanel` reads
 * `useClientGrattageInvoicesQuery` (`domains/grattage/invoices`'s own
 * public surface, widened this phase) — a SEPARATE Network←Grattage import
 * from `AgentOutstandingPanel`'s own `domains/grattage/outstanding` one
 * (Agent 360, a different submodule, a different backend contract);
 * neither panel imports the other's Grattage submodule.
 *
 * STATUS ACTION FIX (M7 Phase 1, unchanged) — a pending Client gets NO
 * status button here, mirroring the identical fix on the list's own row
 * action: `toggleStatus()` 400s a pending client outright (see
 * `client-status-dialog.tsx`'s own docblock for the full source
 * verification).
 */
export function ClientWorkspacePage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();

  const clientQuery = useClientQuery(id ?? -1, { enabled: id !== undefined });

  const [editing, setEditing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const canUpdate = has(PERMISSIONS.UPDATE_CLIENT);
  const canToggleStatus = has(PERMISSIONS.MANAGE_CLIENT_STATUS);
  const canAssign = has(PERMISSIONS.ASSIGN_CLIENT);
  const canViewAgents = has(PERMISSIONS.VIEW_AGENTS);

  const errorReference = isAppError(clientQuery.error)
    ? resolveErrorDisplay(clientQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Client</h1>
        <ListErrorState
          message="This client reference is invalid."
          onRetry={() => navigate(-1)}
          retryLabel="Go back"
        />
      </div>
    );
  }

  if (clientQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Client</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    const notFound =
      isAppError(clientQuery.error) && clientQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Client</h1>
        <ListErrorState
          message={
            notFound
              ? "This client could not be found."
              : "This client could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void clientQuery.refetch()}
        />
      </div>
    );
  }

  const client = clientQuery.data;
  const canOfferStatusAction = canToggleStatus && client.status !== "pending";

  return (
    <WorkspacePage
      title={formatPhone(client.phone)}
      status={
        <StatusBadge
          tone={CLIENT_STATUS_TONES[client.status]}
          label={CLIENT_STATUS_LABELS[client.status]}
        />
      }
      actions={
        <>
          {canUpdate ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {canOfferStatusAction ? (
            <Button variant="outline" onClick={() => setTogglingStatus(true)}>
              {client.status === "active" ? "Block" : "Activate"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-sm">Phone</dt>
            <dd className="text-sm">{formatPhone(client.phone)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">City</dt>
            <dd className="text-sm">{client.ville ?? ABSENT}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Sector</dt>
            <dd className="text-sm">{client.secteur ?? ABSENT}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Client since</dt>
            <dd className="text-sm">{formatDate(client.createdAt)}</dd>
          </div>
        </dl>
      </div>

      <ClientCommercialSection
        commercial={client.commercial}
        canViewAgents={canViewAgents}
        canAssign={canAssign}
        onReassign={() => setReassigning(true)}
      />

      <PanelBoundary>
        <ClientAssignmentHistoryPanel clientId={client.id} />
      </PanelBoundary>

      <PanelBoundary>
        <ClientGrattagePanel clientId={client.id} />
      </PanelBoundary>

      <ClientFormSheet open={editing} onOpenChange={setEditing} client={client} />
      <ClientStatusDialog
        client={togglingStatus ? client : undefined}
        onOpenChange={setTogglingStatus}
      />
      <ClientReassignDrawer
        open={reassigning}
        onOpenChange={setReassigning}
        client={reassigning ? client : undefined}
      />
    </WorkspacePage>
  );
}
