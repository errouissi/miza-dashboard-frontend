import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatDateTime, formatIdentifier } from "@/shared/formatters";
import { StatusBadge, type StatusTone } from "@/shared/components/business/status-badge";
import { MoneyAmount } from "@/shared/components/business/money-amount";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { ValidateDepositDialog } from "../components/validate-deposit-dialog";
import { RejectDepositDialog } from "../components/reject-deposit-dialog";
import {
  useDepositQuery,
  useLinkedGrattageInvoicesQuery,
} from "../queries/deposits-queries";
import { DEPOSITS_PATH } from "../routes";
import {
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_PROOF_TYPE_LABELS,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_STATUS_TONES,
  DEPOSIT_TYPE_LABELS,
} from "../model/deposit";

/**
 * A DOMAIN-LOCAL COPY of Grattage's own four-status vocabulary (M6 Phase
 * 4) — NOT an import from `domains/grattage/invoices` (Option B, see
 * `fetchLinkedGrattageInvoices`'s own docblock in `api/deposits-api.ts`
 * for the full reasoning). Copied verbatim from Design System §17's own
 * canonical mapping, the same source Grattage's own
 * `GRATTAGE_INVOICE_STATUS_TONES` was built from — both are independent,
 * correct readings of the same frozen spec, not one derived from the
 * other.
 */
const LINKED_INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  overdue: "Overdue",
  settled: "Settled",
  cancelled: "Cancelled",
};

const LINKED_INVOICE_STATUS_TONES: Record<string, StatusTone> = {
  pending: "warning",
  overdue: "danger",
  settled: "success",
  cancelled: "muted",
};

/**
 * The Deposit Detail page (M4.3 Phase 2) — the second detail page in this
 * product.
 *
 * A DOMAIN-LOCAL PAGE, DELIBERATELY NOT A NEW SHARED `DetailPage` —
 * confirmed explicitly this phase: the codebase's Rule-of-Three (CLAUDE.md,
 * "evidenced across three independent domains") is not met with two
 * consumers (Cheques, now Deposits). Structurally mirrors
 * `ChequeDetailPage` (header + `StatusBadge` + facts grid + conditional
 * sections), but with NO action buttons — Validate/Reject/Create are later
 * M4.3 phases, not built here.
 *
 * DISPLAYS ALL 15 FIELDS `show()` RETURNS — re-verified fresh from source
 * this phase (`DepoResource::toArray()`, unchanged since Phase 1's own
 * re-verification): id, amount, status, type, method, receipt, proofUrl,
 * createdAt, agentName, agentAccountNumber, createdBy, rejectReason,
 * validatedByName, validatedAt, bankName, proofType. Nothing is left
 * unmapped this time (unlike `ChequeDetailPage`'s BC-Z-blocked "processed
 * by" — Deposits has no equivalent gap).
 *
 * WORDING REUSES `ChequeDetailPage`'s OWN ESTABLISHED LABELS where the
 * concept is genuinely the same — "Submitted" for the creation date,
 * "Processed" for the validate/reject timestamp+actor — rather than
 * inventing new copy for an equivalent idea.
 *
 * TWO DIFFERENT NULL-HANDLING SHAPES, both existing conventions, applied
 * to the field they actually fit:
 *   - `rejectReason` and `validatedByName`/`validatedAt` are STATUS-SCOPED
 *     concepts (only a rejected deposit has a reject reason; only a
 *     validated-or-rejected one has been processed) — their SECTIONS are
 *     conditionally rendered, per this phase's own explicit scope ("show
 *     reject reason only for a rejected deposit when present").
 *   - `bankName` is a plain optional field with NO status meaning — it
 *     stays in the main facts grid, using the SAME `?? "—"` placeholder
 *     convention `ChequeDetailPage`'s own `decisionReason` field already
 *     uses, rather than conditionally hiding the row.
 *
 * `amount` RENDERS THROUGH `<MoneyAmount>` — genuinely appropriate here,
 * same as the list page (see `model/deposit.ts`'s own docblock).
 *
 * `type`/`method` RENDER AS PLAIN TEXT, NOT `StatusBadge` — same reasoning
 * as the list page.
 *
 * ACTIONS (M4.3 Phase 3) — Validate/Reject live HERE ONLY, not on the list
 * page (your own confirmed scope). Each button is gated on BOTH its own
 * permission AND the deposit's current status — BOTH actions only while
 * `pending`, for BOTH deposit types (`canBeProcessed()` is a single,
 * type-agnostic check server-side — verified from source, unlike Cheques'
 * own three-way pending/approved split for approve/reject/annuler).
 * Validated and rejected deposits hide both buttons, mirroring
 * `ManagerStatusDialog`'s own "don't offer a guaranteed backend no-op"
 * precedent Cheques' own dialogs already established.
 *
 * NO TOAST/NOTIFICATION LIBRARY EXISTS IN THIS CODEBASE (re-confirmed this
 * phase, same finding `create-cheque-page.tsx`'s own docblock already
 * made) — success feedback is the SAME existing pattern every mutation in
 * this app already uses: the dialog closes, the invalidated query
 * refetches, and the new status (`StatusBadge` here, plus the newly
 * revealed "Processed" section) IS the confirmation, exactly like
 * `ChequeDetailPage`'s own approve/reject/annuler dialogs.
 *
 * "GRATTAGE INVOICES" SECTION (M6 Phase 4) — shown ONLY for
 * `type === "grattage"` (a `rapped` deposit can never have linked
 * invoices) AND ONLY when the viewer separately holds `access-dashboard`
 * (`useLinkedGrattageInvoicesQuery`'s own docblock has the full
 * permission-independence reasoning). Reads
 * `fetchLinkedGrattageInvoices` — a NARROW, PRIVATE, Deposits-owned
 * duplicate of a slice of Grattage's own `index()` mapper (Option B,
 * `api/deposits-api.ts`'s own docblock), not an import of
 * `domains/grattage/invoices`. NO ROW CAP — a reconciliation deposit's
 * linked set is inherently small (bounded by one agent's outstanding
 * invoices at one moment), so every returned row is rendered, each
 * linking to its own Grattage Invoice detail page via a LITERAL
 * `/grattage/invoices/{id}` path (same "literal, not an import"
 * discipline the reverse direction uses — see
 * `GrattageInvoiceDetailPage`'s own docblock).
 */
export function DepositDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [activeAction, setActiveAction] = useState<"validate" | "reject" | null>(null);

  const depositQuery = useDepositQuery(id ?? -1, { enabled: id !== undefined });

  /**
   * M6 Phase 4 — gated on BOTH `deposit.type === "grattage"` (a `rapped`
   * deposit can never have linked invoices) AND `access-dashboard`
   * INDEPENDENTLY of `view-depos` (already required to reach this page at
   * all) — see `useLinkedGrattageInvoicesQuery`'s own docblock for why
   * these are genuinely separate grants, not one implying the other.
   */
  const canViewGrattageSection = has(PERMISSIONS.ACCESS_DASHBOARD);
  const linkedInvoicesQuery = useLinkedGrattageInvoicesQuery(
    depositQuery.data?.id ?? -1,
    {
      enabled:
        depositQuery.data !== undefined &&
        depositQuery.data.type === "grattage" &&
        canViewGrattageSection,
    },
  );

  const errorReference = isAppError(depositQuery.error)
    ? resolveErrorDisplay(depositQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Deposit</h1>
        <ListErrorState
          message="This deposit reference is invalid."
          onRetry={() => navigate(DEPOSITS_PATH)}
          retryLabel="Back to Deposits"
        />
      </div>
    );
  }

  if (depositQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Deposit</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (depositQuery.isError) {
    const notFound =
      isAppError(depositQuery.error) && depositQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Deposit</h1>
        <ListErrorState
          message={
            notFound
              ? "This deposit could not be found."
              : "This deposit could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void depositQuery.refetch()}
        />
      </div>
    );
  }

  const deposit = depositQuery.data;
  const showProcessed =
    deposit.status !== "pending" && (deposit.validatedByName || deposit.validatedAt);
  const showRejectReason = deposit.status === "rejected" && deposit.rejectReason;

  const canValidate = has(PERMISSIONS.VALIDATE_DEPOSIT) && deposit.status === "pending";
  const canReject = has(PERMISSIONS.REJECT_DEPOSIT) && deposit.status === "pending";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Deposit #{deposit.id}</h1>
          <StatusBadge
            tone={DEPOSIT_STATUS_TONES[deposit.status]}
            label={DEPOSIT_STATUS_LABELS[deposit.status]}
          />
        </div>
        <div className="flex gap-2">
          {canValidate ? (
            <Button onClick={() => setActiveAction("validate")}>Validate</Button>
          ) : null}
          {canReject ? (
            <Button variant="destructive" onClick={() => setActiveAction("reject")}>
              Reject
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => navigate(DEPOSITS_PATH)}>
            Back to Deposits
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Receipt</dt>
          <dd className="text-sm">{formatIdentifier(deposit.receipt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Agent</dt>
          <dd className="text-sm">{deposit.agentName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Agent account number</dt>
          <dd className="text-sm">{formatIdentifier(deposit.agentAccountNumber)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          <dd className="text-sm">
            <MoneyAmount value={deposit.amount} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Type</dt>
          <dd className="text-sm">{DEPOSIT_TYPE_LABELS[deposit.type]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Method</dt>
          <dd className="text-sm">{DEPOSIT_METHOD_LABELS[deposit.method]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Status</dt>
          <dd className="text-sm">
            <StatusBadge
              tone={DEPOSIT_STATUS_TONES[deposit.status]}
              label={DEPOSIT_STATUS_LABELS[deposit.status]}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(deposit.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Created by</dt>
          <dd className="text-sm">{deposit.createdBy}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Bank name</dt>
          <dd className="text-sm">{deposit.bankName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Proof type</dt>
          <dd className="text-sm">{DEPOSIT_PROOF_TYPE_LABELS[deposit.proofType]}</dd>
        </div>
      </dl>

      {deposit.proofUrl ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Proof</h2>
          <img
            src={deposit.proofUrl}
            alt={`Deposit ${deposit.id} proof`}
            className="max-w-md rounded-md border"
          />
        </div>
      ) : null}

      {showProcessed ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Processed</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Processed by</dt>
              <dd className="text-sm">{deposit.validatedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Processed at</dt>
              <dd className="text-sm">{formatDateTime(deposit.validatedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {showRejectReason ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Reject reason</h2>
          <p className="text-sm">{deposit.rejectReason}</p>
        </div>
      ) : null}

      {deposit.type === "grattage" && canViewGrattageSection ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Grattage invoices</h2>
          {linkedInvoicesQuery.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : linkedInvoicesQuery.isError ? (
            <p className="text-destructive text-sm">
              The linked invoices could not be loaded.
            </p>
          ) : linkedInvoicesQuery.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No grattage invoices are linked to this deposit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1.5 pr-4 font-medium">Invoice</th>
                    <th className="py-1.5 pr-4 font-medium">Status</th>
                    <th className="py-1.5 pr-4 text-right font-medium">Amount</th>
                    <th className="py-1.5 pr-4 font-medium">Sold</th>
                    <th className="py-1.5 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedInvoicesQuery.data.map((invoice) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="py-1.5 pr-4">#{invoice.id}</td>
                      <td className="py-1.5 pr-4">
                        <StatusBadge
                          tone={LINKED_INVOICE_STATUS_TONES[invoice.status]}
                          label={LINKED_INVOICE_STATUS_LABELS[invoice.status]}
                        />
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">
                        {invoice.totalAmount} DH
                      </td>
                      <td className="py-1.5 pr-4">{formatDate(invoice.soldAt)}</td>
                      <td className="py-1.5">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => navigate(`/grattage/invoices/${invoice.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ValidateDepositDialog
        deposit={activeAction === "validate" ? deposit : undefined}
        onOpenChange={(open) => setActiveAction(open ? "validate" : null)}
      />
      <RejectDepositDialog
        deposit={activeAction === "reject" ? deposit : undefined}
        onOpenChange={(open) => setActiveAction(open ? "reject" : null)}
      />
    </div>
  );
}
