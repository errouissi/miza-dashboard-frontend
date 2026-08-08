import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { ABSENT, formatDateTime, formatIdentifier } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { PanelBoundary } from "@/shared/components/patterns/panel-boundary";
import { WorkspacePage } from "@/shared/components/patterns/workspace-page";
import { AgentEditDrawer } from "../components/agent-edit-drawer";
import { AgentMoneyPanel } from "../components/agent-money-panel";
import { AgentOutstandingPanel } from "../components/agent-outstanding-panel";
import { AgentStatusDialog } from "../components/agent-status-dialog";
import { AgentStockPanel } from "../components/agent-stock-panel";
import { useAgentQuery } from "../queries/agents-queries";
import { agentDetailPath } from "../routes";
import { AGENT_STATUS_LABELS, AGENT_STATUS_TONES } from "../model/agent";

/**
 * Agent 360 (roadmap M7, Phase 1) — the WorkspacePage that resolves
 * ADR-0014's own deferral (M7 discovery, G2): this IS the detail experience
 * the frozen architecture always intended for an agent, not an interim
 * plain detail page later replaced by one.
 *
 * PHASE 1 IS NETWORK/IDENTITY ONLY. No Money, Stock, or Grattage panel yet —
 * each is its own later M7 phase, composed here the same way (mechanism 1:
 * this page imports each domain's own public surface, no domain learns
 * about another).
 *
 * REACHED FROM MANAGERS'/COMMERCIALS' OWN LIST ROWS (Architecture §6: "Agent
 * detail... reached from the Network module"), never from a dedicated nav
 * entry — the same reasoning `AGENT_ONBOARDING_PATH` is reached only via
 * those lists' own "Create..." buttons, not a sidebar item of its own.
 *
 * BLOCK/ACTIVATE ARE A FRESH, PARALLEL IMPLEMENTATION (`AgentStatusDialog`),
 * not an import of `ManagerStatusDialog`'s/`CommercialStatusDialog`'s own
 * private mutations — both are private to their own domains, and the
 * underlying endpoints are identical regardless of role (ADR-0012).
 *
 * EDIT (M7 Phase 1.5) — `AgentEditDrawer`, gated independently on
 * `update-agent`, exactly like Block/Activate each gate independently on
 * their own permission. Slots into the action row Phase 1 already reserved
 * for it — no restructuring of this page or `WorkspacePage` was needed.
 *
 * MONEY + STOCK PANELS (M7 Phase 2) — `AgentMoneyPanel`/`AgentStockPanel`,
 * each wrapped in its own `PanelBoundary`: a render crash in one can never
 * blank the identity header, the Profile/Documents sections above, or the
 * OTHER panel. Neither panel imports the other's domain, and neither
 * learns anything about this page beyond the `agentId`/`agent` it is
 * handed — mechanism 1 (composition at the page), the same as every prior
 * phase here.
 *
 * OUTSTANDING PANEL (M7 Phase 3) — `AgentOutstandingPanel`, wired in
 * independently of Money and Stock, its own `PanelBoundary`. Composes
 * Grattage Outstanding's own public surface (widened this phase); Network
 * still does not import anything from Stock's own Grattage restock-gate
 * integration (`AgentTransferDetailPage`) and vice versa — two separate,
 * unrelated consumers of the same underlying Grattage Outstanding read.
 *
 * MANAGER NAME DEEP-LINKS TO THAT MANAGER'S OWN AGENT 360 (Agent 360
 * completion item, small polish) — `agentDetailPath(agent.manager.id)`,
 * the same route helper this page's own callers already use; no new
 * surface, `AgentManagerSummary.id` was already in hand.
 */
export function AgentWorkspacePage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();

  const agentQuery = useAgentQuery(id ?? -1, { enabled: id !== undefined });

  const [blocking, setBlocking] = useState(false);
  const [activating, setActivating] = useState(false);
  const [editing, setEditing] = useState(false);

  const canBlock = has(PERMISSIONS.BLOCK_AGENT);
  const canActivate = has(PERMISSIONS.ACTIVATE_AGENT);
  const canUpdate = has(PERMISSIONS.UPDATE_AGENT);

  const errorReference = isAppError(agentQuery.error)
    ? resolveErrorDisplay(agentQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Agent</h1>
        <ListErrorState
          message="This agent reference is invalid."
          onRetry={() => navigate(-1)}
          retryLabel="Go back"
        />
      </div>
    );
  }

  if (agentQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Agent</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (agentQuery.isError) {
    const notFound = isAppError(agentQuery.error) && agentQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Agent</h1>
        <ListErrorState
          message={
            notFound
              ? "This agent could not be found."
              : "This agent could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void agentQuery.refetch()}
        />
      </div>
    );
  }

  const agent = agentQuery.data;
  const isManager = agent.role === "manager";
  const fullName = `${agent.prenom} ${agent.nom}`;
  const roleLabel = isManager ? "Manager" : "Commercial";

  const documents = [
    { label: "Photo", url: agent.photoUrl },
    { label: "CIN (recto)", url: agent.photoCinRectoUrl },
    { label: "CIN (verso)", url: agent.photoCinVersoUrl },
    { label: "Carte auto-entrepreneur", url: agent.carteAutoEntrepreneurUrl },
    { label: "Certificat d'habitat", url: agent.certificatHabitatUrl },
    { label: "Fiche antropométrique", url: agent.ficheAntroprometriqueUrl },
    { label: "Fiche d'incident bancaire", url: agent.ficheIncidentBancaireUrl },
  ].filter((document) => document.url !== null);

  return (
    <WorkspacePage
      title={fullName}
      status={
        <StatusBadge
          tone={AGENT_STATUS_TONES[agent.status]}
          label={AGENT_STATUS_LABELS[agent.status]}
        />
      }
      actions={
        <>
          {canUpdate ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {canBlock && agent.status !== "blocked" ? (
            <Button variant="outline" onClick={() => setBlocking(true)}>
              Block
            </Button>
          ) : null}
          {canActivate && agent.status !== "active" ? (
            <Button variant="outline" onClick={() => setActivating(true)}>
              Activate
            </Button>
          ) : null}
        </>
      }
      facts={
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt="" /> : null}
            <AvatarFallback>
              {agent.prenom.slice(0, 1)}
              {agent.nom.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{roleLabel}</span>
            <span className="text-muted-foreground text-xs">
              {formatIdentifier(agent.numCompte)}
            </span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-sm">CIN</dt>
            <dd className="text-sm">{formatIdentifier(agent.numCin)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">ICE</dt>
            <dd className="text-sm">{formatIdentifier(agent.numIce)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Subscription</dt>
            <dd className="text-sm">{agent.numAbonnement ?? ABSENT}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">City</dt>
            <dd className="text-sm">{agent.ville ?? ABSENT}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Address</dt>
            <dd className="text-sm">{agent.adresse ?? ABSENT}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Joined</dt>
            <dd className="text-sm">{formatDateTime(agent.dateAjout)}</dd>
          </div>
          {isManager ? (
            <div>
              <dt className="text-muted-foreground text-sm">Area of responsibility</dt>
              <dd className="text-sm">{agent.villeSousResponsabilite ?? ABSENT}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt className="text-muted-foreground text-sm">Current city</dt>
                <dd className="text-sm">{agent.villeActuelle ?? ABSENT}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Sector</dt>
                <dd className="text-sm">{agent.secteur ?? ABSENT}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Manager</dt>
                <dd className="text-sm">
                  {agent.manager ? (
                    <Link
                      to={agentDetailPath(agent.manager.id)}
                      className="text-primary underline underline-offset-4"
                    >
                      {agent.manager.prenom} {agent.manager.nom}
                    </Link>
                  ) : (
                    ABSENT
                  )}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Documents</h2>
          <ul className="flex flex-col gap-1">
            {documents.map((document) => (
              <li key={document.label}>
                <a
                  href={document.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-sm underline underline-offset-4"
                >
                  {document.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PanelBoundary>
        <AgentMoneyPanel agentId={agent.id} />
      </PanelBoundary>
      <PanelBoundary>
        <AgentStockPanel agent={agent} />
      </PanelBoundary>
      <PanelBoundary>
        <AgentOutstandingPanel agent={agent} />
      </PanelBoundary>

      <AgentStatusDialog
        agent={blocking ? agent : undefined}
        action="block"
        onOpenChange={setBlocking}
      />
      <AgentStatusDialog
        agent={activating ? agent : undefined}
        action="activate"
        onOpenChange={setActivating}
      />
      <AgentEditDrawer open={editing} onOpenChange={setEditing} agent={agent} />
    </WorkspacePage>
  );
}
