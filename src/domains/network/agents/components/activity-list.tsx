import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";

/**
 * The "up to 5 most recent, with a View all link" shape every Agent 360
 * activity sub-section shares (Deposits, Cheques, Allocations, Agent
 * Transfers, Agent Stock Returns — M7 Phase 2). Domain-local, NOT
 * `shared/`: this exact shape has exactly one caller domain (`agents`),
 * reused five times inside it — cross-domain reuse (the bar `shared/`
 * requires) has not been evidenced, and duplicating this one small
 * component into five files would only obscure that all five ARE the same
 * shape today. Built on the already-shared, domain-agnostic
 * `ListLoadingState`/`ListErrorState`/`ListEmptyState` rather than
 * reinventing them.
 *
 * SLICES TO 5 HERE, NOT AT THE QUERY — every underlying list query already
 * fetches a full page (`per_page` defaults to 15, unconfigurable per each
 * resource's own list page); asking for fewer would be inventing a
 * capability none of these five endpoints expose. This component takes
 * whatever page came back and shows only its first 5 rows.
 *
 * `viewAllHref` IS OPTIONAL (M7 Phase 3) — Grattage Outstanding's own
 * `invoices` set is already the COMPLETE bounded set for one agent, not a
 * page of a larger paginated list, and the Grattage Invoices list page's
 * own UI does not read an `agent_id` URL filter (Phase 1 scope, verified —
 * `grattage-invoices-list-page.tsx`'s own docblock). Linking there would
 * silently show the unfiltered full list, which is worse than no link.
 * `AgentOutstandingPanel` omits the prop; every Phase 2 caller keeps
 * passing it unchanged.
 */
export type ActivityListProps<T> = {
  title: string;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry: () => void;
  items: T[];
  renderRow: (item: T) => ReactNode;
  emptyMessage: string;
  viewAllHref?: string;
};

export function ActivityList<T>({
  title,
  isPending,
  isError,
  errorMessage,
  onRetry,
  items,
  renderRow,
  emptyMessage,
  viewAllHref,
}: ActivityListProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {viewAllHref ? (
          <Link
            to={viewAllHref}
            className="text-primary text-xs underline underline-offset-4"
          >
            View all
          </Link>
        ) : null}
      </div>

      {isPending ? (
        <ListLoadingState rows={2} />
      ) : isError ? (
        <ListErrorState message={errorMessage} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <ListEmptyState>{emptyMessage}</ListEmptyState>
      ) : (
        <ul className="flex flex-col gap-1.5">{items.slice(0, 5).map(renderRow)}</ul>
      )}
    </div>
  );
}
