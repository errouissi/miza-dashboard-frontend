import { Link } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate, formatIdentifier } from "@/shared/formatters";
import { MoneyAmount } from "@/shared/components/business/money-amount";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import {
  DEPOSITS_PATH,
  DEPOSIT_LIST_DEFAULTS,
  DEPOSIT_TYPE_LABELS,
  useDepositsQuery,
} from "@/domains/money/deposits";

const PAGE_SIZE = 5;

/**
 * M7 Overview Phase 1 — pending Deposits. Reuses Deposits' own public
 * `useDepositsQuery` unchanged (mechanism 1) — no new API/model/query.
 *
 * NO `perPage` REQUEST PARAMETER EXISTS ON `DepositListParams` — verified
 * from its own docblock: `index()` hardcodes `paginate(20)` server-side and
 * never reads `per_page` at all. Unlike the Cheques widget, this one cannot
 * ask the backend for 5 rows; it requests the domain's own default (status
 * = pending) and slices to the first 5 for this compact display — the
 * response's own `total` (the REAL paginator total, not a count of the
 * slice) is what "Showing 5 of N" discloses, never a number derived from
 * the 5 rendered rows.
 *
 * GATED ON `VIEW_DEPOSITS` ONLY.
 *
 * Navigation goes to `DEPOSITS_PATH?status=pending` — reusing the EXACT
 * `?status=` URL convention `DepositsListPage`'s own `readParams`/`PARAM`
 * already implements (verified from source), not a new filtering contract
 * invented for Overview. No Deposit detail page exists in this product
 * (ADR-0014-class scope), so no per-row link is offered.
 *
 * SPLIT INTO AN OUTER GATE + AN INNER CONTENT COMPONENT — same reasoning
 * as `PendingChequesWidget`'s own docblock: `useDepositsQuery` has no
 * `enabled` option, so the permission check conditionally MOUNTS
 * `PendingDepositsContent` rather than gating inside one component after
 * the hook already ran.
 */
export function PendingDepositsWidget() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.VIEW_DEPOSITS);

  if (!canView) return null;

  return <PendingDepositsContent />;
}

function PendingDepositsContent() {
  const query = useDepositsQuery({ ...DEPOSIT_LIST_DEFAULTS, status: "pending" });

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ??
      "Pending deposits could not be loaded.")
    : "Pending deposits could not be loaded.";

  const rows = query.isSuccess ? query.data.items.slice(0, PAGE_SIZE) : [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Pending Deposits</h2>
        <Link
          to={`${DEPOSITS_PATH}?status=pending`}
          className="text-primary text-xs underline underline-offset-4"
        >
          View all
        </Link>
      </div>

      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <ListEmptyState>No pending deposits.</ListEmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((deposit) => (
              <li
                key={deposit.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex flex-col">
                  <span>{formatIdentifier(deposit.receipt)}</span>
                  <span className="text-muted-foreground text-xs">
                    {deposit.agentName} · {DEPOSIT_TYPE_LABELS[deposit.type]} ·{" "}
                    {formatDate(deposit.createdAt)}
                  </span>
                </span>
                <MoneyAmount value={deposit.amount} />
              </li>
            ))}
          </ul>
          {query.data.total > rows.length ? (
            <p className="text-muted-foreground text-xs">
              Showing {rows.length} of {query.data.total}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
