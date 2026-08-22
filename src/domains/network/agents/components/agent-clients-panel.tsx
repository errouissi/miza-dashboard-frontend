import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { ABSENT, formatDate, formatPhone } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { StatusBadge } from "@/shared/components/business/status-badge";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import {
  useClientsQuery,
  clientDetailPath,
  CLIENT_LIST_DEFAULTS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
} from "@/domains/network/clients";
import type { Agent } from "../model/agent";

/**
 * Agent 360's Commercial-side Clients panel (Manager Demo Readiness, Item
 * 3) — mechanism 1 (composition at the page, FTA §4): imports Clients' own
 * widened public surface (`useClientsQuery`, gained the optional `agentId`
 * filter this panel is the first caller of — see `model/client.ts`'s own
 * docblock). Clients never learns Agents exists.
 *
 * COMMERCIAL ONLY — a Manager has no clients of their own (clients are
 * assigned to a Commercial `agent_id`, never a Manager), so this returns
 * `null` for `agent.role === "manager"`, the same defensive-render
 * discipline `AgentOutstandingPanel`/`AgentStockPanel` already establish
 * for their own role-scoped concerns.
 *
 * GATED ON `view-clients`, THE CLIENTS DOMAIN'S OWN PERMISSION — not
 * `view-agents` (the page's own gate) and not `access-dashboard` (Money/
 * Stock/Outstanding's gate). Independently permission-gated, matching
 * every other Agent 360 panel: a session without `view-clients` sees
 * nothing here and fires no request, even if it can otherwise view this
 * agent.
 *
 * REUSES THE EXISTING `GET /admin/clients` LIST ENDPOINT, no new API. The
 * backend already validates and applies an `agent_id` filter
 * (`ClientController::index`) — this panel is simply the first frontend
 * caller to send it.
 */
export function AgentClientsPanel({ agent }: { agent: Agent }) {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canView = has(PERMISSIONS.VIEW_CLIENTS);
  const [page, setPage] = useState(1);

  const query = useClientsQuery(
    { ...CLIENT_LIST_DEFAULTS, agentId: agent.id, page },
    { enabled: canView && agent.role === "commercial" },
  );

  if (agent.role !== "commercial" || !canView) return null;

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ??
      "This commercial's clients could not be loaded.")
    : "This commercial's clients could not be loaded.";

  const result = query.data;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Clients</h2>
      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : result && result.items.length === 0 ? (
        <ListEmptyState>No client assigned to this commercial.</ListEmptyState>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="p-2 font-medium">
                    Phone
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Sector
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Joined
                  </th>
                  <th scope="col" className="w-24 p-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result?.items.map((client) => (
                  <tr key={client.id} className="border-b">
                    <td className="p-2">{formatPhone(client.phone)}</td>
                    <td className="p-2">
                      <StatusBadge
                        tone={CLIENT_STATUS_TONES[client.status]}
                        label={CLIENT_STATUS_LABELS[client.status]}
                      />
                    </td>
                    <td className="p-2">{client.secteur ?? ABSENT}</td>
                    <td className="p-2">{formatDate(client.dateDebut)}</td>
                    <td className="p-2">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(clientDetailPath(client.id))}
                          aria-label={`View ${client.phone}`}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result && result.lastPage > 1 ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Page {result.page} of {result.lastPage} · {result.total} clients
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  onClick={() => setPage(result.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= result.lastPage}
                  onClick={() => setPage(result.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
