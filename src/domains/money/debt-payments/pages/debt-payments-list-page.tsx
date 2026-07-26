import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatIdentifier } from "@/shared/formatters";
import { DataTable, type DataTableColumn } from "@/shared/components/business/data-table";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { Button } from "@/shared/components/ui/button";
import { useDebtPaymentsQuery } from "../queries/debt-payments-queries";
import { DEBT_PAYMENTS_NEW_PATH } from "../routes";
import { DEBT_PAYMENT_LIST_DEFAULTS, type DebtPayment } from "../model/debt-payment";

/**
 * The Debt Payments list (roadmap M4) — the third and final Money resource,
 * and by far the simplest: NO FILTERS (`index()` accepts none — verified
 * from source), NO STATUS COLUMN (this model has no lifecycle), NO ACTION
 * COLUMN linking to a detail page (the backend route is commented out —
 * dead code, confirmed from source).
 *
 * A SUMMARY STRIP RENDERS `current_debt`/`total_paid` ABOVE THE TABLE —
 * the first list response in this app carrying extra scalar context
 * alongside its rows (`model/debt-payment.ts`'s own docblock). No existing
 * shared component fits two plain labelled numbers; this is page-local
 * markup, not a new shared abstraction for a single caller.
 *
 * `amount` RENDERS VERBATIM, NOT THROUGH `<MoneyAmount>` — `DebtPayment
 * .amount` is a `decimal:2`-cast STRING (same discipline as `Cheque
 * .amount`), never parsed to a number.
 *
 * A "Proof" LINK COLUMN EXISTS HERE, UNLIKE CHEQUES'/DEPOSITS' OWN LIST
 * PAGES (which defer proof display to their detail pages) — this domain
 * has no detail page to defer to, so the list is the only place the
 * uploaded proof can ever be viewed.
 */
export function DebtPaymentsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get("page"));
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEBT_PAYMENT_LIST_DEFAULTS.page;

  const debtPaymentsQuery = useDebtPaymentsQuery({ page });
  const { has } = usePermission();
  const canRecordPayment = has(PERMISSIONS.DEBT_PAYMENTS);

  const setPage = (nextPage: number) => {
    const query = new URLSearchParams();
    if (nextPage !== DEBT_PAYMENT_LIST_DEFAULTS.page) query.set("page", String(nextPage));
    setSearchParams(query, { replace: true });
  };

  const result = debtPaymentsQuery.data;

  const listErrorReference = isAppError(debtPaymentsQuery.error)
    ? resolveErrorDisplay(debtPaymentsQuery.error).requestId
    : undefined;

  const columns: DataTableColumn<DebtPayment>[] = [
    {
      key: "receipt",
      header: "Receipt",
      cell: (payment) => formatIdentifier(payment.receipt),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (payment) => `${payment.amount} DH`,
    },
    {
      key: "proof",
      header: "Proof",
      cell: (payment) =>
        payment.proofUrl ? (
          <a
            href={payment.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            View proof
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "createdAt",
      header: "Date",
      cell: (payment) => formatDate(payment.createdAt),
    },
  ];

  return (
    <ListPage
      title="Debt Payments"
      action={
        canRecordPayment ? (
          <Button onClick={() => navigate(DEBT_PAYMENTS_NEW_PATH)}>Record Payment</Button>
        ) : null
      }
      footer={
        result && result.page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {result.page.page} of {result.page.lastPage} · {result.page.total}{" "}
              payments
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={result.page.page <= 1}
                onClick={() => setPage(result.page.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={result.page.page >= result.page.lastPage}
                onClick={() => setPage(result.page.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {result ? (
        <div className="flex flex-wrap gap-6 rounded-md border p-4">
          <div>
            <p className="text-muted-foreground text-sm">Current debt</p>
            <p className="text-lg font-semibold">{result.summary.currentDebt} DH</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Total paid</p>
            <p className="text-lg font-semibold">{result.summary.totalPaid} DH</p>
          </div>
        </div>
      ) : null}

      {debtPaymentsQuery.isPending ? (
        <ListLoadingState />
      ) : debtPaymentsQuery.isError ? (
        <ListErrorState
          message="The list of debt payments could not be loaded."
          reference={listErrorReference}
          onRetry={() => void debtPaymentsQuery.refetch()}
        />
      ) : result && result.page.items.length === 0 ? (
        <ListEmptyState>No debt payment yet.</ListEmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={result?.page.items ?? []}
          rowKey={(payment) => payment.id}
        />
      )}
    </ListPage>
  );
}
