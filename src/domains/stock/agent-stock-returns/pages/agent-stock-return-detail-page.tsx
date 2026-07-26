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
import { LineItemsEditor } from "@/shared/components/business/line-items-editor";
import { useProductOptionsQuery } from "@/domains/reference/products";
import { ValidateReturnDialog } from "../components/validate-return-dialog";
import {
  useAddAgentStockReturnLineMutation,
  useAgentStockReturnQuery,
  useRemoveAgentStockReturnLineMutation,
  useUpdateAgentStockReturnLineMutation,
} from "../queries/agent-stock-returns-queries";
import { AGENT_STOCK_RETURNS_PATH } from "../routes";
import {
  AGENT_STOCK_RETURN_STATUS_LABELS,
  AGENT_STOCK_RETURN_STATUS_TONES,
} from "../model/agent-stock-return";

/**
 * The Agent Stock Return Detail page (roadmap M5, Phase 1) — the first
 * Stock detail page, and the first screen in this product combining a
 * DraftLifecyclePage-shaped header with `LineItemsEditor`.
 *
 * A DOMAIN-LOCAL PAGE, NOT `DraftLifecyclePage` — the shared shell is
 * explicitly deferred to the THIRD Stock consumer (Allocations, per the
 * approved implementation order), the same Rule-of-Three discipline every
 * prior "shared pattern named in a frozen doc" decision in this codebase
 * has followed (`DetailPage`, `ApprovalQueuePage`).
 *
 * LINES ARE EDITABLE ONLY WHILE `status === "draft"` —
 * `AgentStockReturnNotEditable` (409, `RETURN_NOT_EDITABLE`) is exactly
 * the backend's own enforcement of this; the UI hides the controls rather
 * than offering an action guaranteed to fail, the same
 * `ManagerStatusDialog`-established precedent every status-gated action in
 * this app already follows. `LineItemsEditor`'s own `readOnly` prop drives
 * this directly from the return's current status.
 *
 * ONE `pendingId`/`lineError` PAIR SHARED ACROSS ALL THREE LINE MUTATIONS —
 * only one line action can be in flight at a time (no optimistic update,
 * FTA D-7); the three mutation hooks are otherwise independent, but this
 * page serializes them through one piece of local state rather than
 * juggling three separate pending/error pairs.
 *
 * VALIDATE — gated on BOTH `validate-agent-stock-return` AND
 * `status === "draft"`, plus (per `RETURN_HAS_NO_LINES`) at least one line
 * — offering Validate on an empty draft is a guaranteed 409, so the button
 * is disabled with an inline hint rather than left to round-trip.
 */
export function AgentStockReturnDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [validateOpen, setValidateOpen] = useState(false);

  const returnQuery = useAgentStockReturnQuery(id ?? -1, { enabled: id !== undefined });
  const productOptionsQuery = useProductOptionsQuery();

  const addLineMutation = useAddAgentStockReturnLineMutation();
  const updateLineMutation = useUpdateAgentStockReturnLineMutation();
  const removeLineMutation = useRemoveAgentStockReturnLineMutation();

  const [pendingId, setPendingId] = useState<number | "new" | null>(null);
  const [lineError, setLineError] = useState<string | undefined>(undefined);

  const describeLineError = (error: unknown): string =>
    isAppError(error)
      ? (resolveErrorDisplay(error).message ?? "This line change could not be saved.")
      : "This line change could not be saved.";

  const errorReference = isAppError(returnQuery.error)
    ? resolveErrorDisplay(returnQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Stock return</h1>
        <ListErrorState
          message="This stock return reference is invalid."
          onRetry={() => navigate(AGENT_STOCK_RETURNS_PATH)}
          retryLabel="Back to Agent Stock Returns"
        />
      </div>
    );
  }

  if (returnQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Stock return</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (returnQuery.isError) {
    const notFound =
      isAppError(returnQuery.error) && returnQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Stock return</h1>
        <ListErrorState
          message={
            notFound
              ? "This stock return could not be found."
              : "This stock return could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void returnQuery.refetch()}
        />
      </div>
    );
  }

  const agentStockReturn = returnQuery.data;
  const isDraft = agentStockReturn.status === "draft";
  const lines = agentStockReturn.lines ?? [];

  const canValidate = has(PERMISSIONS.VALIDATE_AGENT_STOCK_RETURN) && isDraft;
  const canEditLines =
    isDraft &&
    (has(PERMISSIONS.CREATE_AGENT_STOCK_RETURN_LINE) ||
      has(PERMISSIONS.UPDATE_AGENT_STOCK_RETURN_LINE) ||
      has(PERMISSIONS.DELETE_AGENT_STOCK_RETURN_LINE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Stock return {formatIdentifier(agentStockReturn.returnNumber)}
          </h1>
          <StatusBadge
            tone={AGENT_STOCK_RETURN_STATUS_TONES[agentStockReturn.status]}
            label={AGENT_STOCK_RETURN_STATUS_LABELS[agentStockReturn.status]}
          />
        </div>
        <div className="flex items-center gap-2">
          {canValidate ? (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={() => setValidateOpen(true)} disabled={lines.length === 0}>
                Validate
              </Button>
              {lines.length === 0 ? (
                <p className="text-muted-foreground text-xs">Add a line first.</p>
              ) : null}
            </div>
          ) : null}
          <Button variant="outline" onClick={() => navigate(AGENT_STOCK_RETURNS_PATH)}>
            Back to Agent Stock Returns
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Commercial</dt>
          <dd className="text-sm">{agentStockReturn.commercialName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Manager</dt>
          <dd className="text-sm">{agentStockReturn.managerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          <dd className="text-sm">{agentStockReturn.montant} DH</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Return date</dt>
          <dd className="text-sm">
            {agentStockReturn.returnDate ? formatDate(agentStockReturn.returnDate) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(agentStockReturn.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Created by</dt>
          <dd className="text-sm">{agentStockReturn.createdByName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Notes</dt>
          <dd className="text-sm">{agentStockReturn.notes ?? "—"}</dd>
        </div>
      </dl>

      {!isDraft ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Processed</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Processed by</dt>
              <dd className="text-sm">{agentStockReturn.approvedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Processed at</dt>
              <dd className="text-sm">{formatDateTime(agentStockReturn.approvedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Lines</h2>
        <LineItemsEditor
          lines={lines}
          productOptions={productOptionsQuery.data ?? []}
          readOnly={!isDraft || !canEditLines}
          pendingId={pendingId}
          error={lineError}
          onAdd={(values) => {
            setPendingId("new");
            setLineError(undefined);
            addLineMutation.mutate(
              { returnId: agentStockReturn.id, values },
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
              { returnId: agentStockReturn.id, lineId, values },
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
              { returnId: agentStockReturn.id, lineId },
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

      <ValidateReturnDialog
        agentStockReturn={validateOpen ? agentStockReturn : undefined}
        onOpenChange={setValidateOpen}
      />
    </div>
  );
}
