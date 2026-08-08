import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  isAppError,
  lookupErrorCode,
  resolveErrorDisplay,
} from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatDateTime, formatIdentifier } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListErrorState } from "@/shared/components/patterns/list-states";
import { LineItemsEditor } from "@/shared/components/business/line-items-editor";
import { useGrattageRestockGateQuery } from "@/domains/grattage/outstanding";
import { ValidateTransferDialog } from "../components/validate-transfer-dialog";
import {
  useAddAgentTransferLineMutation,
  useAgentTransferQuery,
  useManagerStockQuery,
  useRemoveAgentTransferLineMutation,
  useUpdateAgentTransferLineMutation,
} from "../queries/agent-transfers-queries";
import { AGENT_TRANSFERS_PATH } from "../routes";
import {
  AGENT_TRANSFER_STATUS_LABELS,
  AGENT_TRANSFER_STATUS_TONES,
} from "../model/agent-transfer";

/**
 * The Agent Transfer Detail page (roadmap M5, Phase 2) — the second Stock
 * detail page, structurally mirroring `AgentStockReturnDetailPage` (reusing
 * `LineItemsEditor` and `useFreshConfirm`-backed `ValidateTransferDialog`
 * unchanged in shape), but written against Transfer's own verified fields
 * (`manager`/`commercial` swap direction relative to Return's own
 * `commercial`/`manager`).
 *
 * A DOMAIN-LOCAL PAGE, NOT `DraftLifecyclePage` — same Rule-of-Three
 * deferral to the THIRD Stock consumer (Allocations) Return's own detail
 * page already established.
 *
 * LINES ARE EDITABLE ONLY WHILE `status === "draft"` —
 * `AgentTransferNotEditable` (409, `TRANSFER_NOT_EDITABLE`) is exactly the
 * backend's own enforcement of this; the UI hides the controls rather than
 * offering an action guaranteed to fail.
 *
 * ONE `pendingId`/`lineError` PAIR SHARED ACROSS ALL THREE LINE MUTATIONS —
 * only one line action can be in flight at a time (no optimistic update,
 * FTA D-7).
 *
 * VALIDATE — gated on BOTH `validate-agent-transfer` AND `status ===
 * "draft"`, plus (per `TRANSFER_HAS_NO_LINES`) at least one line — offering
 * Validate on an empty draft is a guaranteed 409, so the button is disabled
 * with an inline hint rather than left to round-trip. A failed validate may
 * ALSO surface `AGENT_TRANSFER_EXCEEDS_CAPACITY` (still handled REACTIVELY
 * ONLY — no proactive stock-quantity/capacity read exists) or
 * `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`, which is now ALSO
 * SURFACED PROACTIVELY (M6 Phase 3): the recipient commercial's own
 * `useGrattageRestockGateQuery` (imported from Grattage's ONE sanctioned
 * public surface, `@/domains/grattage/outstanding`) drives a persistent
 * warning banner below AND disables Validate directly — the reactive 409
 * path (`ValidateTransferDialog`'s own error-code resolution) stays wired
 * unchanged as the authoritative fallback, since this proactive read is a
 * UX hint, not a guarantee.
 *
 * THE "ADD LINE" PRODUCT PICKER IS NOW BACKED BY REAL AVAILABILITY —
 * `useManagerStockQuery` (`GET /admin/managers/{manager}/stock`), added
 * once the backend started exposing per-manager product availability.
 * Replaces the generic, unfiltered `useProductOptionsQuery()` this page
 * used before that contract existed; every option offered here already has
 * `available_quantity > 0` (filtered server-side).
 */
export function AgentTransferDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [validateOpen, setValidateOpen] = useState(false);

  const transferQuery = useAgentTransferQuery(id ?? -1, { enabled: id !== undefined });
  const managerStockQuery = useManagerStockQuery(transferQuery.data?.managerId ?? -1, {
    enabled: transferQuery.data !== undefined,
  });
  /** M6 Phase 3 — the recipient COMMERCIAL's own gate (`agentTransfer.commercialId`, never the manager). */
  const restockGateQuery = useGrattageRestockGateQuery(
    transferQuery.data?.commercialId ?? -1,
    {
      enabled: transferQuery.data !== undefined,
    },
  );

  const addLineMutation = useAddAgentTransferLineMutation();
  const updateLineMutation = useUpdateAgentTransferLineMutation();
  const removeLineMutation = useRemoveAgentTransferLineMutation();

  const [pendingId, setPendingId] = useState<number | "new" | null>(null);
  const [lineError, setLineError] = useState<string | undefined>(undefined);

  const describeLineError = (error: unknown): string =>
    isAppError(error)
      ? (resolveErrorDisplay(error).message ?? "This line change could not be saved.")
      : "This line change could not be saved.";

  const errorReference = isAppError(transferQuery.error)
    ? resolveErrorDisplay(transferQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Transfer</h1>
        <ListErrorState
          message="This transfer reference is invalid."
          onRetry={() => navigate(AGENT_TRANSFERS_PATH)}
          retryLabel="Back to Agent Transfers"
        />
      </div>
    );
  }

  if (transferQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Transfer</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (transferQuery.isError) {
    const notFound =
      isAppError(transferQuery.error) && transferQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Transfer</h1>
        <ListErrorState
          message={
            notFound
              ? "This transfer could not be found."
              : "This transfer could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void transferQuery.refetch()}
        />
      </div>
    );
  }

  const agentTransfer = transferQuery.data;
  const isDraft = agentTransfer.status === "draft";
  const lines = agentTransfer.lines ?? [];

  const canValidate = has(PERMISSIONS.VALIDATE_AGENT_TRANSFER) && isDraft;
  const canEditLines =
    isDraft &&
    (has(PERMISSIONS.CREATE_AGENT_TRANSFER_LINE) ||
      has(PERMISSIONS.UPDATE_AGENT_TRANSFER_LINE) ||
      has(PERMISSIONS.DELETE_AGENT_TRANSFER_LINE));

  /**
   * M6 Phase 3 — a missing/loading read never blocks anything on its own
   * (`?? false`): the backend's own `StockService::validateTransfer` is
   * the authority, this is a UX hint. Shown only while `isDraft` — the
   * warning is only actionable while Validate itself is still reachable.
   */
  const restockGateBlocked = restockGateQuery.data?.blocked ?? false;
  const showRestockGateWarning = isDraft && restockGateBlocked;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Transfer {formatIdentifier(agentTransfer.transferNumber)}
          </h1>
          <StatusBadge
            tone={AGENT_TRANSFER_STATUS_TONES[agentTransfer.status]}
            label={AGENT_TRANSFER_STATUS_LABELS[agentTransfer.status]}
          />
        </div>
        <div className="flex items-center gap-2">
          {canValidate ? (
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => setValidateOpen(true)}
                disabled={lines.length === 0 || restockGateBlocked}
              >
                Validate
              </Button>
              {lines.length === 0 ? (
                <p className="text-muted-foreground text-xs">Add a line first.</p>
              ) : null}
            </div>
          ) : null}
          <Button variant="outline" onClick={() => navigate(AGENT_TRANSFERS_PATH)}>
            Back to Agent Transfers
          </Button>
        </div>
      </div>

      {showRestockGateWarning ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          {lookupErrorCode("TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION")?.message}
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Manager</dt>
          <dd className="text-sm">{agentTransfer.managerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Commercial</dt>
          <dd className="text-sm">{agentTransfer.commercialName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          <dd className="text-sm">{agentTransfer.montant} DH</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Transfer date</dt>
          <dd className="text-sm">
            {agentTransfer.transferDate ? formatDate(agentTransfer.transferDate) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(agentTransfer.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Created by</dt>
          <dd className="text-sm">{agentTransfer.createdByName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Notes</dt>
          <dd className="text-sm">{agentTransfer.notes ?? "—"}</dd>
        </div>
      </dl>

      {!isDraft ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Processed</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Processed by</dt>
              <dd className="text-sm">{agentTransfer.approvedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Processed at</dt>
              <dd className="text-sm">{formatDateTime(agentTransfer.approvedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Lines</h2>
        <LineItemsEditor
          lines={lines}
          productOptions={(managerStockQuery.data ?? []).map((item) => ({
            id: item.productId,
            name: item.name,
          }))}
          readOnly={!isDraft || !canEditLines}
          pendingId={pendingId}
          error={lineError}
          onAdd={(values) => {
            setPendingId("new");
            setLineError(undefined);
            addLineMutation.mutate(
              { transferId: agentTransfer.id, values },
              {
                onSuccess: () => setPendingId(null),
                onError: (error) => {
                  setPendingId(null);
                  setLineError(describeLineError(error));
                },
              },
            );
          }}
          onUpdate={(lineId, values) => {
            setPendingId(lineId);
            setLineError(undefined);
            updateLineMutation.mutate(
              { transferId: agentTransfer.id, lineId, values },
              {
                onSuccess: () => setPendingId(null),
                onError: (error) => {
                  setPendingId(null);
                  setLineError(describeLineError(error));
                },
              },
            );
          }}
          onRemove={(lineId) => {
            setPendingId(lineId);
            setLineError(undefined);
            removeLineMutation.mutate(
              { transferId: agentTransfer.id, lineId },
              {
                onSuccess: () => setPendingId(null),
                onError: (error) => {
                  setPendingId(null);
                  setLineError(describeLineError(error));
                },
              },
            );
          }}
        />
      </div>

      <ValidateTransferDialog
        agentTransfer={validateOpen ? agentTransfer : undefined}
        onOpenChange={setValidateOpen}
        restockGateBlocked={restockGateBlocked}
      />
    </div>
  );
}
