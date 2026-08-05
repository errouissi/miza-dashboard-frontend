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
import { ValidateAllocationDialog } from "../components/validate-allocation-dialog";
import {
  useAddAllocationLineMutation,
  useAllocationQuery,
  useCompanyStockQuery,
  useRemoveAllocationLineMutation,
  useUpdateAllocationLineMutation,
} from "../queries/allocations-queries";
import { ALLOCATIONS_PATH } from "../routes";
import { ALLOCATION_STATUS_LABELS, ALLOCATION_STATUS_TONES } from "../model/allocation";

/**
 * The Allocation Detail page (roadmap M5, Phase 4) — the fourth Stock
 * detail page, structurally mirroring `AgentTransferDetailPage` (reusing
 * `LineItemsEditor` and `useFreshConfirm`-backed `ValidateAllocationDialog`
 * unchanged in shape), but written against Allocation's own verified
 * fields (`company`/`agent`, not `manager`/`commercial`).
 *
 * A DOMAIN-LOCAL PAGE, NOT `DraftLifecyclePage` — same Rule-of-Three
 * deferral Return's/Transfer's own detail pages already established; this
 * is only the THIRD Stock consumer of the shape, still short of extraction
 * evidence on its own (Bons, Phase 5, would be the fourth).
 *
 * NO "CONSUMPTIONS" (DEPOSIT-FUNDING) SECTION — verified from source that
 * `AllocationController::show()` never eager-loads the `consumptions`
 * relation; only `validateAllocation()`'s own response does. A field
 * reliably absent on every read this page performs (including right after
 * a page reload post-validate) has no data to render — see
 * `model/allocation.ts`'s own docblock for why it is not modelled at all.
 *
 * LINES ARE EDITABLE ONLY WHILE `status === "draft"` — `AllocationNotEditable`
 * (409, `ALLOCATION_NOT_EDITABLE`) is exactly the backend's own enforcement
 * of this; the UI hides the controls rather than offering an action
 * guaranteed to fail.
 *
 * ONE `pendingId`/`lineError` PAIR SHARED ACROSS ALL THREE LINE MUTATIONS —
 * only one line action can be in flight at a time (no optimistic update,
 * FTA D-7).
 *
 * VALIDATE — gated on BOTH `validate-allocation` AND `status === "draft"`,
 * plus (per `ALLOCATION_HAS_NO_LINES`) at least one line — offering
 * Validate on an empty draft is a guaranteed 409, so the button is disabled
 * with an inline hint rather than left to round-trip. A failed validate may
 * ALSO surface `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` or
 * `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` — both handled reactively by
 * `ValidateAllocationDialog`'s own error-code resolution; NEITHER gate is
 * about product-level stock, so BC-AA's own restraint (no proactive
 * capacity/obligation hint) is unchanged by the "add line" picker below.
 *
 * THE "ADD LINE" PRODUCT PICKER IS NOW BACKED BY REAL AVAILABILITY —
 * `useCompanyStockQuery` (`GET /admin/companies/{company}/stock`), added
 * once the backend started exposing per-company product availability.
 * Replaces the generic, unfiltered `useProductOptionsQuery()` this page
 * used before that contract existed; every option offered here already has
 * `available_quantity > 0` (filtered server-side), so `ALLOCATION_STOCK_
 * INSUFFICIENT` can still fire (the picker reflects availability at
 * render time, not at the instant of submission) but can no longer be
 * triggered by a product the company never had any of.
 */
export function AllocationDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const { has } = usePermission();
  const [validateOpen, setValidateOpen] = useState(false);

  const allocationQuery = useAllocationQuery(id ?? -1, { enabled: id !== undefined });
  const companyStockQuery = useCompanyStockQuery(allocationQuery.data?.companyId ?? -1, {
    enabled: allocationQuery.data !== undefined,
  });

  const addLineMutation = useAddAllocationLineMutation();
  const updateLineMutation = useUpdateAllocationLineMutation();
  const removeLineMutation = useRemoveAllocationLineMutation();

  const [pendingId, setPendingId] = useState<number | "new" | null>(null);
  const [lineError, setLineError] = useState<string | undefined>(undefined);

  const describeLineError = (error: unknown): string =>
    isAppError(error)
      ? (resolveErrorDisplay(error).message ?? "This line change could not be saved.")
      : "This line change could not be saved.";

  const errorReference = isAppError(allocationQuery.error)
    ? resolveErrorDisplay(allocationQuery.error).requestId
    : undefined;

  if (id === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Allocation</h1>
        <ListErrorState
          message="This allocation reference is invalid."
          onRetry={() => navigate(ALLOCATIONS_PATH)}
          retryLabel="Back to Allocations"
        />
      </div>
    );
  }

  if (allocationQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <h1 className="text-2xl font-bold">Allocation</h1>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  if (allocationQuery.isError) {
    const notFound =
      isAppError(allocationQuery.error) && allocationQuery.error.kind === "notfound";
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Allocation</h1>
        <ListErrorState
          message={
            notFound
              ? "This allocation could not be found."
              : "This allocation could not be loaded."
          }
          reference={errorReference}
          onRetry={() => void allocationQuery.refetch()}
        />
      </div>
    );
  }

  const allocation = allocationQuery.data;
  const isDraft = allocation.status === "draft";
  const lines = allocation.lines ?? [];

  const canValidate = has(PERMISSIONS.VALIDATE_ALLOCATION) && isDraft;
  const canEditLines =
    isDraft &&
    (has(PERMISSIONS.CREATE_ALLOCATION_LINE) ||
      has(PERMISSIONS.UPDATE_ALLOCATION_LINE) ||
      has(PERMISSIONS.DELETE_ALLOCATION_LINE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Allocation {formatIdentifier(allocation.allocationNumber)}
          </h1>
          <StatusBadge
            tone={ALLOCATION_STATUS_TONES[allocation.status]}
            label={ALLOCATION_STATUS_LABELS[allocation.status]}
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
          <Button variant="outline" onClick={() => navigate(ALLOCATIONS_PATH)}>
            Back to Allocations
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-sm">Company</dt>
          <dd className="text-sm">{allocation.companyName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Manager</dt>
          <dd className="text-sm">{allocation.agentName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Amount</dt>
          <dd className="text-sm">{allocation.montant} DH</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Submitted</dt>
          <dd className="text-sm">{formatDate(allocation.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Created by</dt>
          <dd className="text-sm">{allocation.createdByName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Notes</dt>
          <dd className="text-sm">{allocation.notes ?? "—"}</dd>
        </div>
      </dl>

      {!isDraft ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Processed</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Processed by</dt>
              <dd className="text-sm">{allocation.approvedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Processed at</dt>
              <dd className="text-sm">{formatDateTime(allocation.approvedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Lines</h2>
        <LineItemsEditor
          lines={lines}
          productOptions={(companyStockQuery.data ?? []).map((item) => ({
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
              { allocationId: allocation.id, values },
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
              { allocationId: allocation.id, lineId, values },
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
              { allocationId: allocation.id, lineId },
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

      <ValidateAllocationDialog
        allocation={validateOpen ? allocation : undefined}
        onOpenChange={setValidateOpen}
      />
    </div>
  );
}
