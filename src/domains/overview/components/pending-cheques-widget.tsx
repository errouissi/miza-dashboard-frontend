import { Link } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate } from "@/shared/formatters";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import {
  CHEQUES_PENDING_PATH,
  CHEQUE_LIST_DEFAULTS,
  useChequesQuery,
} from "@/domains/money/cheques";

const PAGE_SIZE = 5;

/**
 * M7 Overview Phase 1 — the highest-value decision queue: pending Cheques.
 * Reuses Cheques' own public `useChequesQuery` unchanged (mechanism 1, FTA
 * §4) — no new API/model/query, no deep import past Cheques' `index.ts`.
 * `perPage: 5` is a real request-level parameter here (unlike the Deposits/
 * Grattage widgets below) — `ChequeListParams` is the one of the three list
 * types that actually carries a `perPage` field the backend honours.
 *
 * `status: "en_attente"` is Cheques' own backend enum value for "pending"
 * (`CHEQUE_STATUSES[0]`, verified from `model/cheque.ts`) — NOT a second,
 * Overview-invented status string.
 *
 * SPLIT INTO AN OUTER GATE + AN INNER CONTENT COMPONENT — `useChequesQuery`
 * has no `enabled` option (it was never needed before: every existing
 * caller sits inside a route already `RequirePermission`-gated). Overview
 * composes this widget with NO such route guard, so `if (!canView) return
 * null` BEFORE calling the hook would violate the Rules of Hooks if both
 * lived in one component. Conditionally MOUNTING `PendingChequesContent`
 * instead is the exact same "no permission, no frame, no request"
 * mechanism `AgentStockPanel`/`ClientGrattagePanel` already use — the
 * query hook itself is never touched or widened.
 */
export function PendingChequesWidget() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.VIEW_CHEQUES);

  if (!canView) return null;

  return <PendingChequesContent />;
}

function PendingChequesContent() {
  const query = useChequesQuery({
    ...CHEQUE_LIST_DEFAULTS,
    status: "en_attente",
    perPage: PAGE_SIZE,
  });

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ?? "Pending cheques could not be loaded.")
    : "Pending cheques could not be loaded.";

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Pending Cheques</h2>
        <Link
          to={CHEQUES_PENDING_PATH}
          className="text-primary text-xs underline underline-offset-4"
        >
          View all
        </Link>
      </div>

      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <ListEmptyState>No pending cheques.</ListEmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {query.data.items.map((cheque) => (
              <li
                key={cheque.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex flex-col">
                  <span>{cheque.numCheque}</span>
                  <span className="text-muted-foreground text-xs">
                    {cheque.agentName} · {formatDate(cheque.createdAt)}
                  </span>
                </span>
                {/* A decimal-cast STRING — rendered verbatim, matching Cheques'
                    own established `amount` convention (never `<MoneyAmount>`). */}
                <span className="tabular-nums">{cheque.amount}</span>
              </li>
            ))}
          </ul>
          {query.data.total > query.data.items.length ? (
            <p className="text-muted-foreground text-xs">
              Showing {query.data.items.length} of {query.data.total}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
