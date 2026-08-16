import { Link } from "react-router-dom";
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
  GRATTAGE_INVOICES_PATH,
  GRATTAGE_INVOICE_LIST_DEFAULTS,
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  grattageInvoiceDetailPath,
  useGrattageInvoicesQuery,
} from "@/domains/grattage/invoices";

const PAGE_SIZE = 5;

/**
 * M7 Overview Phase 1 — overdue Grattage Invoices. Reuses the general
 * `useGrattageInvoicesQuery`, widened onto `domains/grattage/invoices`'s
 * own public surface for exactly this caller (see that module's own
 * `index.ts` docblock) — no new API/model/query, no duplicate mapper.
 *
 * NO `perPage` REQUEST PARAMETER EXISTS ON `GrattageInvoiceListParams`
 * (verified from its own docblock: the general list deliberately exposes
 * no per-page control, unlike `useClientGrattageInvoicesQuery`'s own
 * lower-level `fetchClientGrattageInvoices`, which is a SEPARATE function
 * this widget does not call). Same restraint as the Deposits widget: request
 * the backend's own default page, slice to 5 for display, disclose the
 * real paginator `total`, never a count of the slice.
 *
 * GATED ON `ACCESS_DASHBOARD` ONLY — the same permission both this read and
 * the Grattage Invoices list/detail pages themselves already carry
 * (verified from source, unchanged since M6).
 *
 * Navigation: the widget-level link goes to
 * `GRATTAGE_INVOICES_PATH?status=overdue`, reusing the exact `?status=`
 * convention `GrattageInvoicesListPage`'s own `readParams`/`PARAM` already
 * implements. Each row links to its own invoice via
 * `grattageInvoiceDetailPath(id)` — a real, permission-compatible
 * destination (the detail page carries the identical `access-dashboard`
 * gate this widget already required to render at all).
 *
 * SPLIT INTO AN OUTER GATE + AN INNER CONTENT COMPONENT — same reasoning
 * as `PendingChequesWidget`'s own docblock: `useGrattageInvoicesQuery` has
 * no `enabled` option, so the permission check conditionally MOUNTS
 * `OverdueGrattageContent` rather than gating inside one component after
 * the hook already ran.
 */
export function OverdueGrattageWidget() {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);

  if (!canView) return null;

  return <OverdueGrattageContent />;
}

function OverdueGrattageContent() {
  const query = useGrattageInvoicesQuery({
    ...GRATTAGE_INVOICE_LIST_DEFAULTS,
    status: "overdue",
  });

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ??
      "Overdue Grattage invoices could not be loaded.")
    : "Overdue Grattage invoices could not be loaded.";

  const rows = query.isSuccess ? query.data.items.slice(0, PAGE_SIZE) : [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Overdue Grattage Invoices</h2>
        <Link
          to={`${GRATTAGE_INVOICES_PATH}?status=overdue`}
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
        <ListEmptyState>No overdue Grattage invoices.</ListEmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex flex-col">
                  <Link
                    to={grattageInvoiceDetailPath(invoice.id)}
                    className="text-primary underline underline-offset-4"
                  >
                    Invoice #{invoice.id}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {invoice.agentName} · {invoice.clientPhone} · Due{" "}
                    {formatDate(invoice.dueAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {/* A decimal-cast STRING — rendered verbatim, matching this
                      domain's own established `totalAmount` convention. */}
                  <span className="tabular-nums">{invoice.totalAmount}</span>
                  <StatusBadge
                    tone={GRATTAGE_INVOICE_STATUS_TONES[invoice.status]}
                    label={GRATTAGE_INVOICE_STATUS_LABELS[invoice.status]}
                  />
                </span>
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
