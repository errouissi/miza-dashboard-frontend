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
  type ManagerStockItem,
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
import { useCommercialStockQuantityQuery } from "../queries/agents-queries";
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
 *
 * COMMERCIAL CURRENT STOCK (M7 Agent 360 discovery item, post-completion) —
 * supersedes the earlier "no authoritative Commercial current-stock
 * endpoint exists" finding. Backend commit `5302f99` added `GET
 * /admin/agents/{agent}/stock-quantity`, already reused (unchanged, no new
 * query/key) from `useCommercialStockQuantityQuery` — the exact same hook
 * `ManagerReassignmentField` calls in `AgentEditDrawer`. Widened again by
 * backend commit `15aa704`: a REAL per-product breakdown now exists
 * (`stock[]`, identical shape to `GET /admin/managers/{manager}/stock`),
 * superseding the earlier "total only, no breakdown" finding — rendered
 * through the SAME `StockProductTable` presentation `ManagerStockTable`
 * already uses below (genuinely identical row contract and markup;
 * verified from source that both endpoints derive `product_id`/`name`/
 * `operator`/`value`/`available_quantity` the same way, `quantity > 0`
 * only). `stock_quantity` is shown too, as a small "Total stock" summary
 * — read directly from the response, never summed from the visible rows.
 * Gated on `ACCESS_DASHBOARD` — the endpoint's own real backend permission,
 * re-verified from `routes/api.php` — NOT `VIEW_AGENT_TRANSFERS`/
 * `VIEW_AGENT_STOCK_RETURN`, which gate unrelated endpoints and would let
 * a request fire without the right permission.
 *
 * COMMERCIAL AVAILABLE GRATTAGE (M7 Agent 360, backend commit `f9a6fe4`) —
 * supersedes the earlier "no authoritative available-capacity read exists"
 * finding. The SAME `stock-quantity` response now also carries
 * `available_grattage`, produced by `StockService::commercialAvailableGrattage()`
 * — verified from source that `validateTransfer()`'s own STEP 7b capacity
 * gate now calls this SAME extracted method on the locked commercial row,
 * so this read and Transfer validation share one calculation, not two.
 * Rendered VERBATIM as the decimal string the backend returns — the same
 * "decimal-cast STRING, never through `MoneyAmount`, never parsed" discipline
 * `AllocationsActivity`/`AgentTransfersActivity`/`AgentStockReturnsActivity`
 * below already apply to `montant`, for the identical reason (a parse/
 * reformat round trip risks float precision loss `formatMoney` is not
 * built to avoid for a value that already arrives as an exact string). No
 * currency suffix — this file's own established `montant` convention has
 * none either, and inventing one here would be new, not reused, formatting.
 * NEVER derived, recomputed, or reconstructed client-side from Transfers,
 * Returns, Deposits, or `montant_avance_grattage` — the backend value is
 * used as-is, informational only; `validateTransfer()`'s own locked STEP 7b
 * remains the sole authority for an actual Transfer.
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
      : canViewStock || canViewTransfers || canViewReturns;

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
        <>
          {canViewStock ? <CommercialStockTotal agentId={agent.id} /> : null}
          {canViewTransfers ? <AgentTransfersActivity agentId={agent.id} /> : null}
          {canViewReturns ? <AgentStockReturnsActivity agentId={agent.id} /> : null}
        </>
      )}
    </div>
  );
}

/**
 * The product/quantity table itself — genuinely identical row contract and
 * markup between Manager's own Current Stock (`ManagerStockItem`) and a
 * Commercial's (`CommercialStockItem`, structurally identical, verified
 * from source in `agents-api.ts`'s own docblock). Presentation only: takes
 * already-resolved rows, owns no query/loading/error/empty state — those
 * genuinely differ per caller (different empty-state copy, and Commercial
 * additionally shows a "Total stock" summary and Available Grattage
 * alongside it), so THIS is the part worth sharing, not the whole
 * component (ADR-0012 — duplication over a forced shared abstraction).
 */
function StockProductTable({ items }: { items: ManagerStockItem[] }) {
  return (
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
        {items.map((item) => (
          <tr key={item.productId} className="border-b">
            <td className="p-1">{item.name}</td>
            <td className="p-1 text-right tabular-nums">{item.availableQuantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Current stock (product breakdown table, via `StockProductTable`, plus a
 * "Total stock" summary read directly from `stockQuantity` — never summed
 * from the visible rows) plus Available Grattage, rendered verbatim with no
 * currency suffix (see the module docblock for why). ONE query, ONE
 * loading/error state for all of it — everything comes from the same
 * response, so a failed read shows one retry that recovers everything,
 * never independent error UIs for one request. `enabled` is never set from
 * this component's own render — `AgentStockPanel` only ever MOUNTS this
 * component when `canViewStock` is true (the same zero-footprint
 * conditional-mounting pattern `ManagerReassignmentField` already
 * established), so the query never fires without the permission.
 *
 * EMPTY STATE is `stockQuantity === 0 && stock.length === 0` — both,
 * deliberately, not either alone: the backend derives both from the same
 * collection in the same call (verified from source, commit `15aa704`), so
 * in practice they are always zero/empty together; checking both is a
 * cheap, honest double-check rather than trusting only one field. Available
 * Grattage still renders in the empty-stock case — it is not conditioned
 * on stock at all, since a commercial with no held stock can still have
 * (or lack) Transfer capacity.
 */
function CommercialStockTotal({ agentId }: { agentId: number }) {
  const query = useCommercialStockQuantityQuery(agentId);
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Stock could not be loaded.")
    : "Stock could not be loaded.";

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Current stock</h3>
        <ListLoadingState rows={2} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Current stock</h3>
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const { stockQuantity, availableGrattage, stock } = query.data;
  const isEmpty = stockQuantity === 0 && stock.length === 0;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Current stock</h3>
        {isEmpty ? (
          <ListEmptyState>No stock currently held.</ListEmptyState>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              Total stock: {stockQuantity} units
            </p>
            <StockProductTable items={stock} />
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Available Grattage</h3>
        {/* A decimal-cast STRING — rendered verbatim, never through
            MoneyAmount, matching this file's own montant convention below. */}
        <p className="text-sm tabular-nums">{availableGrattage}</p>
      </div>
    </>
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
        <StockProductTable items={query.data ?? []} />
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
