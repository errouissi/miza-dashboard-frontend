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
import { ValidateBonDialog } from "../components/validate-bon-dialog";
import { CancelBonDialog } from "../components/cancel-bon-dialog";
import {
  useAddBonLineMutation,
  useBonQuery,
  useRemoveBonLineMutation,
  useUpdateBonLineMutation,
} from "../queries/bons-queries";
import { BONS_PATH } from "../routes";
import { BON_STATUS_LABELS, BON_STATUS_TONES } from "../model/bon";

/**
 * The Bon Detail page (roadmap M5, Phase 5) — the fifth and final Stock
 * detail page, structurally mirroring `AllocationDetailPage` (reusing
 * `LineItemsEditor`), but with the ONLY cancel lifecycle in Stock
 * (BC-AB) added alongside Validate.
 *
 * EVIDENCE IS SHOWN AS A PLAIN LINK, NOT AN `<img>` — unlike Cheques' own
 * photo (image-only), Bon's evidence may be a PDF (`mimes:jpeg,png,jpg,
 * pdf`); assuming an image would break for a PDF upload. The link opens
 * the backend's own unsigned public URL in a new tab.
 *
 * TWO STATUS-DEPENDENT SECTIONS, NOT ONE — "Processed" (approvedByName/
 * approvedAt) shows whenever `status !== "draft"` (validated OR
 * cancelled — a cancelled bon keeps its original approval history,
 * confirmed from source: `cancelBon()` never clears `approved_by`/
 * `approved_at`). "Cancelled" (cancelledAt/cancellationReason) shows ONLY
 * when `status === "cancelled"`, additively alongside "Processed", not
 * instead of it.
 *
 * NO "CANCELLED BY" FIELD — `BonController` never eager-loads a
 * `cancelledBy` relation on any response (verified from source), so there
 * is no name to resolve; see `model/bon.ts`'s own docblock for why a bare
 * ID is not rendered instead.
 *
 * VALIDATE — gated on BOTH `validate-bon` AND `status === "draft"`, plus
 * (per `BON_HAS_NO_LINES`) at least one line. CANCEL — gated on BOTH
 * `cancel-bon` AND `status === "validated"` — no line-count guard, since
 * cancellation has no such precondition. A failed cancel may surface
 * `BON_CANCEL_STOCK_INSUFFICIENT`, handled reactively by
 * `CancelBonDialog`'s own error-code resolution.
 *
 * ONE `pendingId`/`lineError` PAIR SHARED ACROSS ALL THREE LINE
 * MUTATIONS — only one line action can be in flight at a time (no
 * optimistic update, FTA D-7).
 */
export function BonDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [validateOpen, setValidateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const bonQuery = useBonQuery(id ?? -1, { enabled: id !== undefined });
  const productOptionsQuery = useProductOptionsQuery();

  const addLineMutation = useAddBonLineMutation();
  const updateLineMutation = useUpdateBonLineMutation();
  const removeLineMutation = useRemoveBonLineMutation();

  const [pendingId, setPendingId] = useState<number | "new" | null>(null);
  const [lineError, setLineError] = useState<string | undefined>(undefined);

  const describeLineError = (error: unknown): string =>
    isAppError(error)
      ? (resolveErrorDisplay(error).message ?? "This line change could not be saved.")
      : "This line change could not be saved.";

  const errorReference = isAppError(bonQuery.error)
    ? resolveErrorDisplay(bonQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Bon</h1>
        <ListErrorState
          message="This bon reference is invalid."
          onRetry={() => navigate(BONS_PATH)}
          retryLabel="Back to Bons"
        />
      </div>
    );
  }

  if (bonQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Bon</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (bonQuery.isError) {
    const notFound = isAppError(bonQuery.error) && bonQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Bon</h1>
        <ListErrorState
          message={
            notFound ? "This bon could not be found." : "This bon could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void bonQuery.refetch()}
        />
      </div>
    );
  }

  const bon = bonQuery.data;
  const isDraft = bon.status === "draft";
  const isValidated = bon.status === "validated";
  const isCancelled = bon.status === "cancelled";
  const lines = bon.lines ?? [];

  const canValidate = has(PERMISSIONS.VALIDATE_BON) && isDraft;
  const canCancel = has(PERMISSIONS.CANCEL_BON) && isValidated;
  const canEditLines =
    isDraft &&
    (has(PERMISSIONS.CREATE_BON_LINE) ||
      has(PERMISSIONS.UPDATE_BON_LINE) ||
      has(PERMISSIONS.DELETE_BON_LINE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Bon {formatIdentifier(bon.bonNumber)}</h1>
          <StatusBadge
            tone={BON_STATUS_TONES[bon.status]}
            label={BON_STATUS_LABELS[bon.status]}
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
          {canCancel ? (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancel bon
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => navigate(BONS_PATH)}>
            Back to Bons
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Supplier</dt>
          <dd className="text-sm">{bon.supplierName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Company</dt>
          <dd className="text-sm">{bon.companyName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          <dd className="text-sm">{bon.montant} DH</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Received date</dt>
          <dd className="text-sm">{bon.receivedAt ? formatDate(bon.receivedAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(bon.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Created by</dt>
          <dd className="text-sm">{bon.createdByName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Notes</dt>
          <dd className="text-sm">{bon.notes ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Evidence</dt>
          <dd className="text-sm">
            {bon.evidenceUrl ? (
              <a
                href={bon.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {bon.evidenceName ?? "View evidence"}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {!isDraft ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Processed</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Processed by</dt>
              <dd className="text-sm">{bon.approvedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Processed at</dt>
              <dd className="text-sm">{formatDateTime(bon.approvedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {isCancelled ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Cancelled</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Cancelled at</dt>
              <dd className="text-sm">{formatDateTime(bon.cancelledAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Reason</dt>
              <dd className="text-sm">{bon.cancellationReason ?? "—"}</dd>
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
              { bonId: bon.id, values },
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
              { bonId: bon.id, lineId, values },
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
              { bonId: bon.id, lineId },
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

      <ValidateBonDialog
        bon={validateOpen ? bon : undefined}
        onOpenChange={setValidateOpen}
      />
      <CancelBonDialog bon={cancelOpen ? bon : undefined} onOpenChange={setCancelOpen} />
    </div>
  );
}
