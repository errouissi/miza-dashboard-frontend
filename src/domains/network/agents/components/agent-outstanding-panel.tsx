import { Link } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate } from "@/shared/formatters";
import { StatusBadge, type StatusTone } from "@/shared/components/business/status-badge";
import {
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import {
  useGrattageOutstandingQuery,
  type GrattageOutstanding,
  type GrattageOutstandingInvoice,
} from "@/domains/grattage/outstanding";
import { grattageInvoiceDetailPath } from "@/domains/grattage/invoices";
import type { Agent } from "../model/agent";
import { ActivityList } from "./activity-list";

/**
 * Agent 360's Outstanding panel (M7 Phase 3) — mechanism 1 (composition at
 * the page), same reasoning as the Money/Stock panels: imports Grattage
 * Outstanding's own public surface (widened this phase per ADR-0026's own
 * anticipated consequence), Grattage never learns Agent 360 exists.
 *
 * ONE QUERY (`useGrattageOutstandingQuery`), NO NEW API/MAPPER/KEY/
 * CALCULATION — `summary`/`restockGate`/`invoices` are all read directly
 * off the shared, already-mapped response; nothing here re-derives a total
 * or re-implements the backend's own gate logic.
 *
 * `restockGate.blocked` IS AN OPERATIONAL SIGNAL SCOPED TO AGENT TRANSFER
 * ELIGIBILITY ONLY (M7 Phase 3, explicit user correction) — never worded as
 * the Agent being globally blocked, the Manager being blocked, Company ->
 * Manager Allocation being blocked, or all Stock operations being blocked.
 * `StockService::validateAllocation()` dropped its own team-wide hard block
 * (ADR-0029); this panel must not reintroduce that meaning through copy.
 *
 * MANAGER VIEW IS DELIBERATELY COARSE — the backend's own
 * `computeGrattageRestockGate()` returns only `{blocked, reason:
 * "TEAM_OUTSTANDING_GRATTAGE" | null}` for a manager; `summary`/`invoices`
 * are always empty for that role (verified from `AgentController
 * ::grattageOutstanding`'s own docblock: "managers never hold invoices").
 * There is no per-commercial breakdown to show — no amount, no invoice
 * count, no commercial count, and NO client-side lookup across Commercials
 * to infer who is blocking, ever. A real backend gap (M7 Phase 3
 * discovery), not worked around here.
 */
export function AgentOutstandingPanel({ agent }: { agent: Agent }) {
  const { has } = usePermission();
  const canView = has(PERMISSIONS.ACCESS_DASHBOARD);
  const query = useGrattageOutstandingQuery(agent.id, { enabled: canView });

  if (!canView) return null;

  const errorMessage = isAppError(query.error)
    ? (resolveErrorDisplay(query.error).message ??
      "Outstanding grattage obligation could not be loaded.")
    : "Outstanding grattage obligation could not be loaded.";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Grattage Outstanding</h2>
      {query.isPending ? (
        <ListLoadingState rows={3} />
      ) : query.isError ? (
        <ListErrorState message={errorMessage} onRetry={() => void query.refetch()} />
      ) : agent.role === "manager" ? (
        <ManagerOutstanding data={query.data} />
      ) : (
        <CommercialOutstanding data={query.data} />
      )}
    </div>
  );
}

const OUTSTANDING_INVOICE_STATUS_LABELS: Record<
  GrattageOutstandingInvoice["status"],
  string
> = {
  pending: "Pending",
  overdue: "Overdue",
};

/** Own copy, not imported from Grattage Invoices (ADR-0012) — same two-value slice of that domain's own four-tone mapping. */
const OUTSTANDING_INVOICE_STATUS_TONES: Record<
  GrattageOutstandingInvoice["status"],
  StatusTone
> = {
  pending: "warning",
  overdue: "danger",
};

function CommercialOutstanding({ data }: { data: GrattageOutstanding }) {
  const { summary, restockGate, invoices } = data;
  const isClear = summary.invoiceCount === 0;

  return (
    <div className="flex flex-col gap-3">
      {isClear ? (
        <p className="text-sm">No outstanding grattage obligation.</p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            Outstanding:{" "}
            <span className="font-medium tabular-nums">{summary.requiredTotal} DH</span>
          </p>
          <p className="text-muted-foreground">
            Pending {summary.pendingTotal} DH · Overdue {summary.overdueTotal} DH
          </p>
          {summary.oldestDueAt ? (
            <p className="text-muted-foreground">
              Oldest due {formatDate(summary.oldestDueAt)}
            </p>
          ) : null}
        </div>
      )}

      {restockGate.blocked ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          New stock transfers to this Commercial are currently blocked until this
          outstanding Grattage obligation is settled.
        </div>
      ) : null}

      {!isClear ? (
        <ActivityList<GrattageOutstandingInvoice>
          title="Outstanding invoices"
          isPending={false}
          isError={false}
          errorMessage=""
          onRetry={() => {}}
          items={invoices}
          emptyMessage="No outstanding invoices."
          renderRow={(invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="flex items-center gap-2">
                <StatusBadge
                  tone={OUTSTANDING_INVOICE_STATUS_TONES[invoice.status]}
                  label={OUTSTANDING_INVOICE_STATUS_LABELS[invoice.status]}
                />
                <span className="text-muted-foreground">
                  Due {formatDate(invoice.dueAt)}
                  {invoice.status === "overdue" && invoice.daysOverdue !== null
                    ? ` (${invoice.daysOverdue}d overdue)`
                    : ""}
                </span>
              </span>
              <Link
                to={grattageInvoiceDetailPath(invoice.id)}
                className="text-primary tabular-nums underline underline-offset-4"
              >
                {invoice.totalAmount} DH
              </Link>
            </li>
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * Deliberately ONE sentence, nothing else — see the module docblock. No
 * amount, no invoice count, no commercial count, no commercial identity, no
 * Allocation wording.
 */
function ManagerOutstanding({ data }: { data: GrattageOutstanding }) {
  return (
    <p className="text-sm">
      {data.restockGate.blocked
        ? "One or more commercials on this team have an outstanding grattage obligation."
        : "No commercial on this team currently has an outstanding grattage obligation."}
    </p>
  );
}
