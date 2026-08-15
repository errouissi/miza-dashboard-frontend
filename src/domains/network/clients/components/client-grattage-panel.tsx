import { Link } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { agentDetailPath } from "@/domains/network/agents";
import {
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  grattageInvoiceDetailPath,
  useClientGrattageInvoicesQuery,
  type GrattageInvoice,
} from "@/domains/grattage/invoices";

/**
 * Client 360 Phase 3's Grattage purchase-history panel — the frozen
 * requirement's own wording, verified fresh from `phase8-architecture.html`
 * §6: "Client detail composes profile/assignment history (Network) with
 * purchase history via grattage invoices (Grattage)." A list of what this
 * Client bought — NOT Agent 360's "Grattage Outstanding" (a Commercial's
 * undischarged obligation TO THE COMPANY, a completely different backend
 * contract — `domains/grattage/outstanding`, never imported here) and NOT a
 * Client financial summary: `SalesService`'s own docblock (backend) is
 * unambiguous that "the client owes nothing; no client balance/debt is
 * tracked at the grattage level." `total_amount` below is the PURCHASE
 * total, rendered with the exact same `{amount} DH` convention
 * `grattage-invoices-list-page.tsx` already uses — never labelled Client
 * debt, outstanding, or owed.
 *
 * THE THIRD INDEPENDENTLY-COMPOSED CLIENT 360 CAPABILITY (Profile/Edit,
 * Commercial relationship + reassignment, Assignment History, now this) —
 * `PanelBoundary`-wrapped by its caller (`ClientWorkspacePage`), the same
 * isolation discipline Assignment History's own panel already established.
 *
 * PERMISSION IS `access-dashboard`, INDEPENDENT OF `view-clients` (the
 * page's own gate) — re-verified fresh from source this phase
 * (`routes/api.php`: `GET /admin/grattage-invoices` carries
 * `permission:access-dashboard`, unchanged since M6). Mirrors
 * `AgentOutstandingPanel`'s own "`if (!canView) return null`" discipline:
 * no panel, no request, no permission-denied placeholder for a capability
 * the viewer cannot reach at all.
 *
 * ONE QUERY, THE SMALLEST SANCTIONED GRATTAGE EXPORT
 * (`useClientGrattageInvoicesQuery`, `domains/grattage/invoices`'s own
 * public surface, widened this phase) — `client_id` filtering is
 * backend-authoritative (`GrattageInvoiceController::index`'s own
 * `where('client_id', ...)`), never re-filtered or re-derived here.
 *
 * EACH ROW'S COMMERCIAL IS THAT INVOICE'S OWN `agent` RELATION —
 * HISTORICAL, NEVER `ClientDetail.commercial` (the CURRENT relationship,
 * read by `ClientCommercialSection`). A Client reassigned after an older
 * purchase must still show the Commercial who actually made that sale, not
 * whoever currently owns the Client — the two are read from entirely
 * separate props/queries here, by construction, not by convention alone.
 * Permission-aware, the identical rule `ClientCommercialSection`/
 * `ClientAssignmentHistoryPanel` already use: `view-agents`, checked
 * independently of `access-dashboard` (which gates this panel's own
 * visibility).
 *
 * COMPACT BY DESIGN: latest 5 only (`useClientGrattageInvoicesQuery`'s own
 * fixed page size), a truthful "Showing latest N of TOTAL" line when
 * `total` exceeds what is shown — no "Load more", no claim of lifetime
 * completeness, the identical convention `ClientAssignmentHistoryPanel`
 * already established. Cancelled invoices are NOT filtered out — a
 * purchase HISTORY does not hide them, the same restraint the history
 * panel's own empty/row rendering already applies. `dueAt`/`declaredAt`/
 * line items/item counts are deliberately NOT rendered — out of THIS
 * phase's scope, not a technical limitation (both are present on the
 * underlying response; the detail page, deep-linked below, already renders
 * what this panel intentionally omits).
 */
type ClientGrattagePanelProps = {
  clientId: number;
};

export function ClientGrattagePanel({ clientId }: ClientGrattagePanelProps) {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);
  const canViewAgents = has(PERMISSIONS.VIEW_AGENTS);
  const query = useClientGrattageInvoicesQuery(clientId, { enabled: canView });

  if (!canView) return null;

  const errorReference = isAppError(query.error)
    ? resolveErrorDisplay(query.error).requestId
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Grattage purchase history</h2>
      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState
          message="Grattage purchase history could not be loaded."
          reference={errorReference}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <ListEmptyState>No recorded Grattage purchases for this client.</ListEmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {query.data.items.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                canViewAgents={canViewAgents}
              />
            ))}
          </ul>
          {query.data.total > query.data.items.length ? (
            <p className="text-muted-foreground text-xs">
              Showing latest {query.data.items.length} of {query.data.total}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function InvoiceRow({
  invoice,
  canViewAgents,
}: {
  invoice: GrattageInvoice;
  canViewAgents: boolean;
}) {
  return (
    <li className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={grattageInvoiceDetailPath(invoice.id)}
          className="text-primary text-sm underline underline-offset-4"
        >
          Invoice #{invoice.id}
        </Link>
        <StatusBadge
          tone={GRATTAGE_INVOICE_STATUS_TONES[invoice.status]}
          label={GRATTAGE_INVOICE_STATUS_LABELS[invoice.status]}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {canViewAgents ? (
          <Link
            to={agentDetailPath(invoice.agentId)}
            className="text-primary underline underline-offset-4"
          >
            {invoice.agentName}
          </Link>
        ) : (
          invoice.agentName
        )}
        {" · "}
        {/* Rendered verbatim, `{amount} DH` — the SAME convention
            `grattage-invoices-list-page.tsx` already uses. This is the
            purchase total, never Client debt/outstanding. */}
        {invoice.totalAmount} DH{" · "}
        Purchased {formatDate(invoice.soldAt)}
      </p>
    </li>
  );
}
