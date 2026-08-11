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
import { WorkspacePage } from "@/shared/components/patterns/workspace-page";
import { ClientFormSheet } from "../components/client-form-sheet";
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
 * PHASE 1 IS IDENTITY/PROFILE/EDIT/STATUS ONLY. No Commercial-relationship
 * panel, no reassignment UI, no assignment-history UI (even though the
 * backend now records it — `client_assignment_histories`, backend commit
 * `7066ffa`), and no Grattage purchase-history panel — each is its own
 * later Client 360 phase. `ClientDetail.commercial` is already on the
 * model (needed for Phase 2's deep link), but nothing on THIS page reads it
 * yet — do not add a relationship section here as a side effect of another
 * change; that is Phase 2's own scope.
 *
 * NO PANEL / PanelBoundary YET — Phase 1 has exactly one query (this page's
 * own `useClientQuery`) and zero domain-composed panels, so there is
 * nothing yet for a per-panel error boundary to isolate FROM (the identical
 * reasoning `WorkspacePage`'s own docblock already gives for deferring it
 * on Agent 360 until a second real panel arrives). Add one at the phase
 * that brings Client 360's own second panel.
 *
 * STATUS ACTION FIX (M7 Phase 1) — a pending Client gets NO status button
 * here, mirroring the identical fix on the list's own row action:
 * `toggleStatus()` 400s a pending client outright (see
 * `client-status-dialog.tsx`'s own docblock for the full source
 * verification). This was a real, pre-existing defect in the shipped M3.4
 * `ClientStatusDialog` (it claimed "Activate" was valid for a pending
 * client), found and fixed as part of this phase, not introduced by it.
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

  const canUpdate = has(PERMISSIONS.UPDATE_CLIENT);
  const canToggleStatus = has(PERMISSIONS.MANAGE_CLIENT_STATUS);

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

      <ClientFormSheet open={editing} onOpenChange={setEditing} client={client} />
      <ClientStatusDialog
        client={togglingStatus ? client : undefined}
        onOpenChange={setTogglingStatus}
      />
    </WorkspacePage>
  );
}
