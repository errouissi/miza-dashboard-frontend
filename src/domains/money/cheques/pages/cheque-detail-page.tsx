import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatDateTime, formatIdentifier } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { ApproveChequeDialog } from "../components/approve-cheque-dialog";
import { RejectChequeDialog } from "../components/reject-cheque-dialog";
import { AnnulerChequeDialog } from "../components/annuler-cheque-dialog";
import { useChequeQuery } from "../queries/cheques-queries";
import { CHEQUES_PATH } from "../routes";
import { CHEQUE_STATUS_LABELS, CHEQUE_STATUS_TONES } from "../model/cheque";

/**
 * The Cheque Detail page (M4.2 Phase 3B) — the first detail page in this
 * product (ADR-0014 deferred every Network detail page; Cheques is the
 * first resource to actually ship one).
 *
 * A DOMAIN-LOCAL PAGE, DELIBERATELY NOT A NEW SHARED `DetailPage` PATTERN —
 * even though the frozen architecture doc names one for exactly this case.
 * CLAUDE.md's own rule cuts against building it now: "promote on stable
 * shared semantics evidenced across three independent domains — never on
 * reuse count alone," and this is the first of one. Extract a shared shell
 * once Deposits' or Debt Payments' own detail page needs the same header +
 * facts + body shape and the commonality is real, not assumed from a name
 * in a doc.
 *
 * DISPLAYS EVERY FIELD `show()` RETURNS THAT THE DOMAIN MODEL ALREADY
 * MAPS — id, amount, numCheque, status, agentName, photoUrl,
 * decisionReason, processedAt, createdAt, allocations. Does NOT display a
 * "processed by" name: BC-Z (verified from source, `ChequeController`'s
 * `show()` eager-loads the wrong relation for `processed_by`, overwriting
 * the raw FK with a mismatched result) means the field cannot be shown
 * correctly today. `next-session.md` already concluded this must stay
 * unmapped until raised with the backend — this page follows that, rather
 * than guessing at a value or showing the known-wrong one.
 *
 * `amount` IS RENDERED VERBATIM, NOT THROUGH `MoneyAmount` — same
 * `decimal:2`-cast-string discipline as the list pages (see
 * `cheques-list-page.tsx`'s own docblock and `model/cheque.ts`).
 *
 * `allocations` ONLY RENDERS WHEN PRESENT (populated for an approved
 * cheque; `undefined` for a pending or rejected one — never an empty array
 * standing in for "not fetched", per the domain model's own contract).
 *
 * ACTIONS (M4.2 Phase 3C) — Approve/Reject/Annuler live HERE ONLY, not on
 * either list page (your own confirmed scope: neither list built an
 * `ApprovalQueuePage`-style actions column at Phase 3B, and this phase does
 * not retrofit one). Each button is gated on BOTH its own permission AND
 * the cheque's current status — Approve/Reject only while `en_attente`,
 * Annuler only while `accepter` — mirroring `ManagerStatusDialog`'s own
 * established precedent of not offering an action the backend would 400 as
 * a no-op. A held permission for a cheque in the wrong status still hides
 * the button; this is a UX courtesy, not a security boundary — the backend
 * remains the sole authority and re-checks on every request regardless.
 */
export function ChequeDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [activeAction, setActiveAction] = useState<
    "approve" | "reject" | "annuler" | null
  >(null);

  const chequeQuery = useChequeQuery(id ?? -1, { enabled: id !== undefined });

  const errorReference = isAppError(chequeQuery.error)
    ? resolveErrorDisplay(chequeQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Cheque</h1>
        <ListErrorState
          message="This cheque reference is invalid."
          onRetry={() => navigate(CHEQUES_PATH)}
          retryLabel="Back to Cheques"
        />
      </div>
    );
  }

  if (chequeQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Cheque</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (chequeQuery.isError) {
    const notFound =
      isAppError(chequeQuery.error) && chequeQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Cheque</h1>
        <ListErrorState
          message={
            notFound
              ? "This cheque could not be found."
              : "This cheque could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void chequeQuery.refetch()}
        />
      </div>
    );
  }

  const cheque = chequeQuery.data;

  const canApprove = has(PERMISSIONS.APPROVE_CHEQUE) && cheque.status === "en_attente";
  const canReject = has(PERMISSIONS.REJECT_CHEQUE) && cheque.status === "en_attente";
  const canAnnuler = has(PERMISSIONS.ANNULER_CHEQUE) && cheque.status === "accepter";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Cheque {formatIdentifier(cheque.numCheque)}
          </h1>
          <StatusBadge
            tone={CHEQUE_STATUS_TONES[cheque.status]}
            label={CHEQUE_STATUS_LABELS[cheque.status]}
          />
        </div>
        <div className="flex gap-2">
          {canApprove ? (
            <Button onClick={() => setActiveAction("approve")}>Approve</Button>
          ) : null}
          {canReject ? (
            <Button variant="destructive" onClick={() => setActiveAction("reject")}>
              Reject
            </Button>
          ) : null}
          {canAnnuler ? (
            <Button variant="destructive" onClick={() => setActiveAction("annuler")}>
              Cancel cheque
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => navigate(CHEQUES_PATH)}>
            Back to Cheques
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Cheque number</dt>
          <dd className="text-sm">{formatIdentifier(cheque.numCheque)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          {/* Rendered verbatim — see the module docblock. Not `<MoneyAmount>`. */}
          <dd className="text-sm">{cheque.amount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Agent</dt>
          <dd className="text-sm">{cheque.agentName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Status</dt>
          <dd className="text-sm">
            <StatusBadge
              tone={CHEQUE_STATUS_TONES[cheque.status]}
              label={CHEQUE_STATUS_LABELS[cheque.status]}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(cheque.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Processed</dt>
          <dd className="text-sm">{formatDateTime(cheque.processedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Decision reason</dt>
          <dd className="text-sm">{cheque.decisionReason ?? "—"}</dd>
        </div>
      </dl>

      {cheque.photoUrl ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Cheque photo</h2>
          <img
            src={cheque.photoUrl}
            alt={`Cheque ${cheque.numCheque}`}
            className="max-w-md rounded-md border"
          />
        </div>
      ) : null}

      {cheque.allocations && cheque.allocations.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Allocations</h2>
          <ul className="flex flex-col gap-1">
            {cheque.allocations.map((allocation) => (
              <li key={allocation.id} className="text-sm">
                {allocation.type} — {allocation.amount}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ApproveChequeDialog
        cheque={activeAction === "approve" ? cheque : undefined}
        onOpenChange={(open) => setActiveAction(open ? "approve" : null)}
      />
      <RejectChequeDialog
        cheque={activeAction === "reject" ? cheque : undefined}
        onOpenChange={(open) => setActiveAction(open ? "reject" : null)}
      />
      <AnnulerChequeDialog
        cheque={activeAction === "annuler" ? cheque : undefined}
        onOpenChange={(open) => setActiveAction(open ? "annuler" : null)}
      />
    </div>
  );
}
