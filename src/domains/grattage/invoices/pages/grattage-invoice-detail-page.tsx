import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatDateTime } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { useProductOptionsQuery } from "@/domains/reference/products";
import { CancelGrattageInvoiceDialog } from "../components/cancel-grattage-invoice-dialog";
import { useGrattageInvoiceQuery } from "../queries/grattage-invoices-queries";
import { GRATTAGE_INVOICES_PATH } from "../routes";
import {
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  isGrattageInvoiceCancellable,
} from "../model/grattage-invoice";

/**
 * The Grattage Invoice Detail page (roadmap M6, Phase 1) — the first
 * Grattage detail page.
 *
 * A DOMAIN-LOCAL PAGE, mirroring `BonDetailPage`'s/`DepositDetailPage`'s
 * own structure (header + `StatusBadge` + facts grid + conditional
 * sections) — the codebase's Rule-of-Three for a shared `DetailPage` shell
 * is still short of three genuinely comparable consumers.
 *
 * DISPLAYS EVERY FIELD `show()` RETURNS THAT THE DOMAIN MODEL MAPS
 * (ADR-0008) — id, status, totalAmount, soldAt, dueAt, declaredAt, agent,
 * client, depositId, sales lines.
 *
 * `depositId` RENDERS AS A REAL LINK TO `/money/deposits/{id}` (M6 Phase
 * 4) — a LITERAL path string, NOT an import of `depositDetailPath` from
 * `@/domains/money/deposits`. Deliberately: importing even a pure
 * path-builder would be a Grattage→Money domain edge, and the one
 * sanctioned domain→domain import in this app is Stock←Grattage (FTA §4,
 * mechanism 2) — adding a second one here, even a lightweight one, was
 * explicitly rejected in favour of the SAME "literal, not an import"
 * discipline `invalidation-map.ts` already uses for exactly this class of
 * problem (a cross-domain reference with no cross-domain coupling). Keep
 * the literal in sync by hand if Money's own route pattern ever changes.
 * No permission check gates the LINK ITSELF — clicking through hits
 * Money's own existing route guard (`view-depos`), which already fails
 * closed correctly; nothing here needs to know or duplicate that check.
 *
 * THE LINK'S LABEL IS STATUS-AWARE, not a fixed string — re-verified from
 * source this phase (`DepositService::createGrattageReconciliation`/
 * `validate`/`reject`): `deposit_id` is set at the DEPOSIT'S OWN
 * *creation*, before it is ever validated, so "settling deposit" would be
 * inaccurate while the deposit (and this invoice) is still
 * `pending`/`overdue` — nothing has settled yet. `invoice.status` is a
 * reliable proxy for which case applies (no extra fetch needed): `status
 * === "settled"` only ever happens once the linked deposit is actually
 * validated, so "Settling deposit" is accurate exactly then; every other
 * `depositId !== null` case (still pending/overdue) keeps the ORIGINAL
 * Phase 1 "Reconciliation deposit" wording, which makes no settlement
 * claim.
 *
 * THE EXPLANATORY FREEZE NOTE (below) is unchanged from Phase 1 — the
 * deposit-link freeze is a real, non-obvious edge case
 * (`GrattageInvoice::isCancellable()`, backend) worth surfacing rather
 * than leaving the operator to guess why Cancel disappeared while the
 * status still reads `pending`/`overdue`.
 *
 * SALES LINES RESOLVE A PRODUCT NAME VIA THE EXISTING, ALREADY-PUBLIC
 * `useProductOptionsQuery()` (Reference domain) — `GrattageInvoiceController`
 * never eager-loads the `sales.product` relation (verified from source),
 * so there is no name on the wire; a deleted/unresolvable product id falls
 * back to a bare `"Product #<id>"` label rather than hiding the line.
 *
 * CANCEL — gated on BOTH `access-dashboard` AND
 * `isGrattageInvoiceCancellable(invoice)` (status pending/overdue AND
 * `depositId === null`), the SAME predicate `CancelGrattageInvoiceDialog`'s
 * own freshness check reuses. No Validate/Settle/Create actions exist on
 * this page — see `model/grattage-invoice.ts`'s own module docblock for
 * why (both hard-403 by backend design).
 */
export function GrattageInvoiceDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [cancelOpen, setCancelOpen] = useState(false);

  const invoiceQuery = useGrattageInvoiceQuery(id ?? -1, { enabled: id !== undefined });
  const productOptionsQuery = useProductOptionsQuery();

  const errorReference = isAppError(invoiceQuery.error)
    ? resolveErrorDisplay(invoiceQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Grattage Invoice</h1>
        <ListErrorState
          message="This invoice reference is invalid."
          onRetry={() => navigate(GRATTAGE_INVOICES_PATH)}
          retryLabel="Back to Grattage Invoices"
        />
      </div>
    );
  }

  if (invoiceQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Grattage Invoice</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (invoiceQuery.isError) {
    const notFound =
      isAppError(invoiceQuery.error) && invoiceQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Grattage Invoice</h1>
        <ListErrorState
          message={
            notFound
              ? "This grattage invoice could not be found."
              : "This grattage invoice could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void invoiceQuery.refetch()}
        />
      </div>
    );
  }

  const invoice = invoiceQuery.data;
  const cancellable = isGrattageInvoiceCancellable(invoice);
  const canCancel = has(PERMISSIONS.ACCESS_DASHBOARD) && cancellable;
  const showDepositFreezeNote =
    (invoice.status === "pending" || invoice.status === "overdue") &&
    invoice.depositId !== null;

  const productName = (productId: number): string =>
    productOptionsQuery.data?.find((option) => option.id === productId)?.name ??
    `Product #${productId}`;

  // See the module docblock — status-aware label, literal path (no
  // cross-domain import).
  const depositLinkLabel =
    invoice.status === "settled"
      ? `Settling deposit #${invoice.depositId}`
      : `Reconciliation deposit #${invoice.depositId}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Grattage Invoice #{invoice.id}</h1>
          <StatusBadge
            tone={GRATTAGE_INVOICE_STATUS_TONES[invoice.status]}
            label={GRATTAGE_INVOICE_STATUS_LABELS[invoice.status]}
          />
        </div>
        <div className="flex items-center gap-2">
          {canCancel ? (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancel invoice
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => navigate(GRATTAGE_INVOICES_PATH)}>
            Back to Grattage Invoices
          </Button>
        </div>
      </div>

      {showDepositFreezeNote ? (
        <p className="border-muted-foreground/30 text-muted-foreground rounded-md border px-4 py-3 text-sm">
          This invoice is linked to reconciliation deposit #{invoice.depositId} and can no
          longer be cancelled directly.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Commercial</dt>
          <dd className="text-sm">{invoice.agentName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Commercial account number</dt>
          <dd className="text-sm">{invoice.agentAccountNumber}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Client</dt>
          <dd className="text-sm">{invoice.clientPhone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          {/* Rendered verbatim — see the module docblock. Not `<MoneyAmount>`. */}
          <dd className="text-sm tabular-nums">{invoice.totalAmount} DH</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Status</dt>
          <dd className="text-sm">
            <StatusBadge
              tone={GRATTAGE_INVOICE_STATUS_TONES[invoice.status]}
              label={GRATTAGE_INVOICE_STATUS_LABELS[invoice.status]}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Sold</dt>
          <dd className="text-sm">{formatDate(invoice.soldAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Due</dt>
          <dd className="text-sm">{formatDateTime(invoice.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Declared</dt>
          <dd className="text-sm">
            {invoice.declaredAt ? formatDateTime(invoice.declaredAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Reconciliation deposit</dt>
          <dd className="text-sm">
            {invoice.depositId !== null ? (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => navigate(`/money/deposits/${invoice.depositId}`)}
              >
                {depositLinkLabel}
              </Button>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sales lines</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1.5 pr-4 font-medium">Product</th>
                <th className="py-1.5 pr-4 font-medium">Quantity</th>
                <th className="py-1.5 pr-4 text-right font-medium">Unit price</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.sales ?? []).map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="py-1.5 pr-4">{productName(line.productId)}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{line.quantity}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {line.unitPrice} DH
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{line.total} DH</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CancelGrattageInvoiceDialog
        invoice={cancelOpen ? invoice : undefined}
        onOpenChange={setCancelOpen}
      />
    </div>
  );
}
