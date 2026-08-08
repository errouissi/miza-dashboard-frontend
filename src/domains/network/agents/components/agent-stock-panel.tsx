import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import {
  ALLOCATIONS_PATH,
  ALLOCATION_LIST_DEFAULTS,
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_TONES,
  useAllocationsQuery,
  type Allocation,
} from "@/domains/stock/allocations";
import {
  AGENT_TRANSFERS_PATH,
  AGENT_TRANSFER_LIST_DEFAULTS,
  AGENT_TRANSFER_STATUS_LABELS,
  AGENT_TRANSFER_STATUS_TONES,
  useAgentTransfersQuery,
  useManagerStockQuery,
  type AgentTransfer,
} from "@/domains/stock/agent-transfers";
import {
  AGENT_STOCK_RETURNS_PATH,
  AGENT_STOCK_RETURN_LIST_DEFAULTS,
  AGENT_STOCK_RETURN_STATUS_LABELS,
  AGENT_STOCK_RETURN_STATUS_TONES,
  useAgentStockReturnsQuery,
  type AgentStockReturn,
} from "@/domains/stock/agent-stock-returns";
import type { Agent } from "../model/agent";
import { ActivityList } from "./activity-list";

/**
 * Agent 360's Stock panel (M7 Phase 2) — mechanism 1, same reasoning as
 * `AgentMoneyPanel`: imports Allocations'/Agent Transfers'/Agent Stock
 * Returns' own public surfaces, none of the three learns Agent 360 exists.
 *
 * ROLE-BRANCHED, unlike the Money panel — a manager's own Stock story
 * (current balance + Allocations received) is genuinely different from a
 * commercial's (Transfers received + Returns sent), not a filter on one
 * shared shape.
 *
 * NO MONETARY TOTAL IS EVER DERIVED HERE. `ManagerStockItem` carries a
 * `value` (a product's own catalogue price) — deliberately NOT rendered,
 * and never multiplied by `availableQuantity` into an invented "stock
 * value" figure. Only `name`/`availableQuantity` are shown, matching the
 * M7 Phase 2 decision precisely ("display only backend-returned
 * product/quantity information").
 */
export function AgentStockPanel({ agent }: { agent: Agent }) {
  const { has } = usePermission();
  const canViewStock = has(PERMISSIONS.ACCESS_DASHBOARD);
  const canViewAllocations = has(PERMISSIONS.VIEW_ALLOCATIONS);
  const canViewTransfers = has(PERMISSIONS.VIEW_AGENT_TRANSFERS);
  const canViewReturns = has(PERMISSIONS.VIEW_AGENT_STOCK_RETURN);

  // The heading itself is gated too, mirroring `AgentMoneyPanel` exactly —
  // no "Stock" heading over an empty space when every sub-section for this
  // agent's own role is hidden.
  const hasAnySection =
    agent.role === "manager"
      ? canViewStock || canViewAllocations
      : canViewTransfers || canViewReturns;

  if (!hasAnySection) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Stock</h2>
      {agent.role === "manager" ? (
        <>
          {canViewStock ? <ManagerStockTable managerId={agent.id} /> : null}
          {canViewAllocations ? <AllocationsActivity agentId={agent.id} /> : null}
        </>
      ) : (
        // NO current-stock/balance sub-section here — no authoritative
        // Commercial current-stock endpoint exists (M7 Phase 2 discovery,
        // re-confirmed: `AgentController::stock()` still hard-404s any
        // non-manager). Omitted entirely, not a disabled placeholder.
        <>
          {canViewTransfers ? <AgentTransfersActivity agentId={agent.id} /> : null}
          {canViewReturns ? <AgentStockReturnsActivity agentId={agent.id} /> : null}
        </>
      )}
    </div>
  );
}

function ManagerStockTable({ managerId }: { managerId: number }) {
  const query = useManagerStockQuery(managerId);
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Stock could not be loaded.")
    : "Stock could not be loaded.";

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Current stock</h3>
      {query.isPending ? (
        <ListLoadingState rows={2} />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <ListEmptyState>No stock allocated to this manager.</ListEmptyState>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-1 font-medium">
                Product
              </th>
              <th scope="col" className="p-1 text-right font-medium">
                Available quantity
              </th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((item) => (
              <tr key={item.productId} className="border-b">
                <td className="p-1">{item.name}</td>
                <td className="p-1 text-right tabular-nums">{item.availableQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AllocationsActivity({ agentId }: { agentId: number }) {
  const query = useAllocationsQuery({
    ...ALLOCATION_LIST_DEFAULTS,
    agentId: String(agentId),
  });
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Allocations could not be loaded.")
    : "Allocations could not be loaded.";

  return (
    <ActivityList<Allocation>
      title="Recent allocations"
      isPending={query.isPending}
      isError={query.isError}
      errorMessage={errorMessage}
      onRetry={() => void query.refetch()}
      items={query.data?.items ?? []}
      emptyMessage="No allocations yet for this manager."
      viewAllHref={`${ALLOCATIONS_PATH}?agent_id=${agentId}`}
      renderRow={(allocation) => (
        <li
          key={allocation.id}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="flex items-center gap-2">
            <StatusBadge
              tone={ALLOCATION_STATUS_TONES[allocation.status]}
              label={ALLOCATION_STATUS_LABELS[allocation.status]}
            />
            <span className="text-muted-foreground">
              {formatDate(allocation.createdAt)}
            </span>
          </span>
          {/* A decimal:2-cast STRING — rendered verbatim, never through MoneyAmount. */}
          <span className="tabular-nums">{allocation.montant}</span>
        </li>
      )}
    />
  );
}

function AgentTransfersActivity({ agentId }: { agentId: number }) {
  const query = useAgentTransfersQuery({
    ...AGENT_TRANSFER_LIST_DEFAULTS,
    commercialId: String(agentId),
  });
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Transfers could not be loaded.")
    : "Transfers could not be loaded.";

  return (
    <ActivityList<AgentTransfer>
      title="Recent transfers"
      isPending={query.isPending}
      isError={query.isError}
      errorMessage={errorMessage}
      onRetry={() => void query.refetch()}
      items={query.data?.items ?? []}
      emptyMessage="No transfers yet for this commercial."
      viewAllHref={`${AGENT_TRANSFERS_PATH}?commercial_id=${agentId}`}
      renderRow={(transfer) => (
        <li key={transfer.id} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <StatusBadge
              tone={AGENT_TRANSFER_STATUS_TONES[transfer.status]}
              label={AGENT_TRANSFER_STATUS_LABELS[transfer.status]}
            />
            <span className="text-muted-foreground">
              {formatDate(transfer.createdAt)}
            </span>
          </span>
          <span className="tabular-nums">{transfer.montant}</span>
        </li>
      )}
    />
  );
}

function AgentStockReturnsActivity({ agentId }: { agentId: number }) {
  const query = useAgentStockReturnsQuery({
    ...AGENT_STOCK_RETURN_LIST_DEFAULTS,
    commercialId: String(agentId),
  });
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Returns could not be loaded.")
    : "Returns could not be loaded.";

  return (
    <ActivityList<AgentStockReturn>
      title="Recent returns"
      isPending={query.isPending}
      isError={query.isError}
      errorMessage={errorMessage}
      onRetry={() => void query.refetch()}
      items={query.data?.items ?? []}
      emptyMessage="No returns yet for this commercial."
      viewAllHref={`${AGENT_STOCK_RETURNS_PATH}?commercial_id=${agentId}`}
      renderRow={(returnItem) => (
        <li
          key={returnItem.id}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="flex items-center gap-2">
            <StatusBadge
              tone={AGENT_STOCK_RETURN_STATUS_TONES[returnItem.status]}
              label={AGENT_STOCK_RETURN_STATUS_LABELS[returnItem.status]}
            />
            <span className="text-muted-foreground">
              {formatDate(returnItem.createdAt)}
            </span>
          </span>
          <span className="tabular-nums">{returnItem.montant}</span>
        </li>
      )}
    />
  );
}
