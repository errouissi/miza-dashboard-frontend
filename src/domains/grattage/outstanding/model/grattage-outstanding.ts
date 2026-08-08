/**
 * Grattage Outstanding — the second Grattage resource (roadmap M6, Phase
 * 2). `GET /admin/agents/{id}/grattage-outstanding` — verified fresh from
 * source this phase (`AgentController::grattageOutstanding`,
 * `computeGrattageRestockGate`), not carried from Phase 1's own discovery
 * pass unchecked.
 *
 * TWO GENUINELY DIFFERENT SCOPES BACK THIS ONE ENDPOINT, and they diverge
 * for a real window of time, not just conceptually:
 *   - `summary` (`GrattageInvoice::outstanding()` — pending|overdue AND
 *     `deposit_id IS NULL`) drops the moment a reconciliation Deposit is
 *     merely CREATED (`DepositService::createGrattageReconciliation` links
 *     invoices via `deposit_id` immediately, before any validation).
 *   - `restockGate` (`GrattageInvoice::undischarged()` — pending|overdue
 *     ONLY, deposit-blind) stays blocked through the ENTIRE
 *     pending-deposit window and only clears once that deposit is
 *     VALIDATED (decision #8a, backend: "deposit submission does NOT
 *     restore the restock gate — only a validated deposit does").
 *   A deposit merely submitted can therefore show `summary.requiredTotal
 *   === 0` while `restockGate.blocked` is still `true` for the same
 *   agent — a real, intended state, not a bug to reconcile.
 *
 * COMMERCIAL VS MANAGER GATE SEMANTICS ARE TWO DIFFERENT QUERIES, not one
 * formula parameterized by role (`computeGrattageRestockGate`, backend):
 *   - A commercial's own gate reads their OWN undischarged invoices ->
 *     `reason: "OUTSTANDING_GRATTAGE"`.
 *   - A manager's own gate reads whether ANY of their commercials has an
 *     undischarged invoice -> `reason: "TEAM_OUTSTANDING_GRATTAGE"`. A
 *     manager never has invoices of their own; their gate is never
 *     derived from `summary`/`invoices` on their own agent id.
 *
 * NO UI CONSUMES THIS MODULE YET, BY DECISION (M6 Phase 2) — both frozen
 * documents place the actual "Outstanding & Restock Gate" VIEW inside
 * Agent 360 (M7), reached from Network, not a Grattage-owned screen. Only
 * `useGrattageRestockGateQuery` (see `queries/`) is exported publicly this
 * phase, for Stock to consume in Phase 3; the full type/query below stay
 * private to this module until M7 has a real caller.
 */

export type GrattageOutstandingManager = {
  id: number;
  nom: string;
  prenom: string;
};

/**
 * `role`/`status` are typed loosely (not narrowed to a literal union) —
 * unlike Managers'/Commercials' own `ManagerStatus`/`CommercialStatus`,
 * nothing in this module branches on either value yet (no UI, no
 * consumer). Narrow them when a real caller needs to, per this codebase's
 * own "map only consumed fields" discipline (ADR-0008) — do not
 * pre-narrow ahead of that.
 */
export type GrattageOutstandingAgent = {
  id: number;
  nom: string;
  prenom: string;
  numCin: string;
  numCompte: string;
  role: string;
  status: string;
  /** `null` for a manager (managers have no manager of their own) or an unassigned commercial. */
  manager: GrattageOutstandingManager | null;
};

export type GrattageOutstandingSummary = {
  /** `decimal`-accumulated STRING (`bcadd`, backend) — never a number. Render verbatim. */
  requiredTotal: string;
  pendingTotal: string;
  overdueTotal: string;
  invoiceCount: number;
  /** ISO-8601, or `null` when `invoiceCount === 0`. */
  oldestDueAt: string | null;
};

/**
 * The two documented reason codes (`computeGrattageRestockGate`, backend)
 * — copied verbatim from source, not normalized to a different
 * vocabulary.
 */
export type GrattageRestockGateReason =
  "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE";

export type GrattageRestockGate = {
  blocked: boolean;
  reason: GrattageRestockGateReason | null;
};

export type GrattageOutstandingInvoice = {
  id: number;
  status: "pending" | "overdue";
  /** `decimal:2`-cast STRING — same verbatim discipline as `GrattageInvoice.totalAmount` (Phase 1). */
  totalAmount: string;
  soldAt: string;
  dueAt: string;
  declaredAt: string | null;
  /** Only non-null while `status === "overdue"` (backend computes this only for that branch). */
  daysOverdue: number | null;
};

export type GrattageOutstanding = {
  agent: GrattageOutstandingAgent;
  summary: GrattageOutstandingSummary;
  restockGate: GrattageRestockGate;
  invoices: GrattageOutstandingInvoice[];
};
