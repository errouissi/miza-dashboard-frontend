import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { MoneyAmount } from "@/shared/components/business/money-amount";
import {
  DEPOSITS_PATH,
  DEPOSIT_LIST_DEFAULTS,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_STATUS_TONES,
  useDepositsQuery,
  type Deposit,
} from "@/domains/money/deposits";
import {
  CHEQUES_PATH,
  CHEQUE_LIST_DEFAULTS,
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  useChequesQuery,
  type Cheque,
} from "@/domains/money/cheques";
import { ActivityList } from "./activity-list";

/**
 * Agent 360's Money panel (M7 Phase 2) — mechanism 1 (composition at the
 * page): imports Deposits' and Cheques' own public surfaces, neither domain
 * learns Agent 360 exists.
 *
 * NO RAW BALANCE FACTS, BY EXPLICIT DECISION (M7 Phase 2 discovery,
 * corrected). `Agent.montant_avance_grattage/rapped`, `solde`, `cash`,
 * `dept` are NOT rendered anywhere in this panel, and this file imports
 * none of them — M6 already established that Grattage/Allocation capacity
 * is backend-authoritative business accounting a raw column cannot
 * represent; showing one here under a label like "balance" or "capacity"
 * would invent financial semantics this component has no authority to
 * assert. A true Financial Summary panel is future scope, gated on a real
 * backend contract for it (none exists today).
 *
 * DEBT PAYMENTS ARE DELIBERATELY ABSENT — re-confirmed this phase:
 * `DebtPaymentController`'s `admin_id` scopes to the ADMIN's own debt to
 * the company, not any agent's. Including it here would misattribute whose
 * obligation it is.
 *
 * EACH SUB-SECTION IS INDEPENDENTLY GATED AND INDEPENDENTLY MOUNTED — an
 * operator holding `view-depos` but not `view-cheques` sees only the
 * Deposits sub-section; the Cheques query never fires (the component that
 * owns it is simply never rendered, not rendered-then-hidden). If NEITHER
 * permission is held, the whole panel renders nothing — there is no
 * "Money" heading over an empty space.
 */
export function AgentMoneyPanel({ agentId }: { agentId: number }) {
  const { has } = usePermission();
  const canViewDeposits = has(PERMISSIONS.VIEW_DEPOSITS);
  const canViewCheques = has(PERMISSIONS.VIEW_CHEQUES);

  if (!canViewDeposits && !canViewCheques) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Money</h2>
      {canViewDeposits ? <DepositsActivity agentId={agentId} /> : null}
      {canViewCheques ? <ChequesActivity agentId={agentId} /> : null}
    </div>
  );
}

function DepositsActivity({ agentId }: { agentId: number }) {
  const query = useDepositsQuery({ ...DEPOSIT_LIST_DEFAULTS, agentId: String(agentId) });
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Deposits could not be loaded.")
    : "Deposits could not be loaded.";

  return (
    <ActivityList<Deposit>
      title="Recent deposits"
      isPending={query.isPending}
      isError={query.isError}
      errorMessage={errorMessage}
      onRetry={() => void query.refetch()}
      items={query.data?.items ?? []}
      emptyMessage="No deposits yet for this agent."
      viewAllHref={`${DEPOSITS_PATH}?agent_id=${agentId}`}
      renderRow={(deposit) => (
        <li key={deposit.id} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <StatusBadge
              tone={DEPOSIT_STATUS_TONES[deposit.status]}
              label={DEPOSIT_STATUS_LABELS[deposit.status]}
            />
            <span className="text-muted-foreground">{formatDate(deposit.createdAt)}</span>
          </span>
          <MoneyAmount value={deposit.amount} />
        </li>
      )}
    />
  );
}

function ChequesActivity({ agentId }: { agentId: number }) {
  const query = useChequesQuery({ ...CHEQUE_LIST_DEFAULTS, agentId: String(agentId) });
  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Cheques could not be loaded.")
    : "Cheques could not be loaded.";

  return (
    <ActivityList<Cheque>
      title="Recent cheques"
      isPending={query.isPending}
      isError={query.isError}
      errorMessage={errorMessage}
      onRetry={() => void query.refetch()}
      items={query.data?.items ?? []}
      emptyMessage="No cheques yet for this agent."
      viewAllHref={`${CHEQUES_PATH}?agent_id=${agentId}`}
      renderRow={(cheque) => (
        <li key={cheque.id} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2">
            <StatusBadge
              tone={CHEQUE_STATUS_TONES[cheque.status]}
              label={CHEQUE_STATUS_LABELS[cheque.status]}
            />
            <span className="text-muted-foreground">{formatDate(cheque.createdAt)}</span>
          </span>
          {/* A decimal:2-cast STRING — rendered verbatim, never through MoneyAmount. */}
          <span className="tabular-nums">{cheque.amount}</span>
        </li>
      )}
    />
  );
}
