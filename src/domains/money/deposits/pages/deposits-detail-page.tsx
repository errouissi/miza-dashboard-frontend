import { useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate, formatDateTime, formatIdentifier } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { MoneyAmount } from "@/shared/components/business/money-amount";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { useDepositQuery } from "../queries/deposits-queries";
import { DEPOSITS_PATH } from "../routes";
import {
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_STATUS_TONES,
  DEPOSIT_TYPE_LABELS,
} from "../model/deposit";

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
 */
export function DepositDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;

  const depositQuery = useDepositQuery(id ?? -1, { enabled: id !== undefined });

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
        <Button variant="outline" onClick={() => navigate(DEPOSITS_PATH)}>
          Back to Deposits
        </Button>
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
          <dd className="text-sm">{deposit.proofType}</dd>
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
    </div>
  );
}
