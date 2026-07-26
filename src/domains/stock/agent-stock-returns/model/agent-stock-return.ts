import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * An Agent Stock Return — the first Stock resource (roadmap M5, Phase 1).
 * A commercial hands grattage stock they hold back UP to their current
 * manager. Reverse direction of an Agent Transfer, same lifecycle shape as
 * all four Stock movement types: draft -> add lines -> irreversible
 * validate. NO CANCEL — verified from source (`routes/api.php`'s
 * `agent-stock-returns` group has no `/cancel` route; only Bons have one
 * today).
 *
 * CONTRACT VERIFIED FRESH FROM SOURCE this phase
 * (`AgentStockReturnController`, `AgentStockReturnResource`, the
 * `AgentStockReturn` model, its FormRequests):
 *
 * `montant` IS METADATA-ONLY — `SUM(line.unit_cost * line.quantity)`,
 * recomputed server-side on every line mutation for reporting/audit. It
 * gates nothing (the real gate is the commercial's stock floor, checked at
 * validate time) and is NEVER a form input — `$fillable` on the model
 * confirms it is not settable from a request.
 *
 * `montant`/line `unitCost` ARE `decimal:2`-CAST STRINGS — same discipline
 * as `Cheque.amount`: rendered verbatim, never parsed for display.
 *
 * DATES ARE ISO-8601 (`created_at`/`approved_at`), confirmed from the
 * Resource's own docblock ("the legacy DepoResource `Y-m-d H:i` precedent
 * is not propagated") — EXCEPT `return_date`, a DATE-ONLY field surfaced as
 * `YYYY-MM-DD` via `toDateString()`, not a datetime.
 *
 * `commercial`/`manager` USE `{id, nom, prenom}` (Agent columns), NOT
 * `{id, name}` — confirmed from the Resource's own `agentShape()` helper,
 * mirroring `AgentTransferResource`.
 *
 * CANCELLATION FIELDS (`cancelled_by`/`cancelled_at`/`cancellation_reason`)
 * ARE DELIBERATELY NOT MODELLED — the Resource's own docblock states they
 * are "RESERVED for a future reversal flow" and always null in this phase;
 * modelling a field with no possible non-null value and no screen that
 * reads it is exactly the speculation ADR-0008/D-11 forbid.
 *
 * `lines`/`validationSummary` ARE OPTIONAL ON THE TYPE — `whenLoaded`
 * means they are PRESENT ON `show()`/every line mutation's response,
 * ABSENT ON `index()` rows — the same "present on show, absent on list"
 * modelling `Cheque.allocations` already established.
 */

export const AGENT_STOCK_RETURN_STATUSES = ["draft", "validated", "cancelled"] as const;
export type AgentStockReturnStatus = (typeof AGENT_STOCK_RETURN_STATUSES)[number];

/** `cancelled` is modelled in the STATUS enum (the column value exists, per `IndexAgentStockReturnRequest`'s own filter) even though no code path sets it yet in this phase — a future cancel lifecycle writes to an already-correct type. */
export const AGENT_STOCK_RETURN_STATUS_LABELS: Record<AgentStockReturnStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  cancelled: "Cancelled",
};

export const AGENT_STOCK_RETURN_STATUS_TONES: Record<AgentStockReturnStatus, StatusTone> =
  {
    draft: "warning",
    validated: "success",
    cancelled: "muted",
  };

export type AgentStockReturnLine = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  /** A `decimal:2`-cast STRING — render verbatim. */
  unitCost: string;
  notes: string | null;
};

export type AgentStockReturn = {
  id: number;
  returnNumber: string;
  status: AgentStockReturnStatus;
  /** Metadata-only, `decimal:2`-cast STRING — see the module docblock. */
  montant: string;
  notes: string | null;
  /** `YYYY-MM-DD`, or `null` — a date-only field, not a datetime. */
  returnDate: string | null;
  commercialId: number;
  commercialName: string;
  managerId: number;
  managerName: string;
  createdByName: string;
  approvedByName: string | null;
  /** ISO-8601, or `null` while still a draft. */
  approvedAt: string | null;
  createdAt: string;
  /** Present on `show()` and every line-mutation response; absent on `index()` rows. */
  lines?: AgentStockReturnLine[];
  validationSummary?: {
    totalLines: number;
    totalQuantity: number;
    /** Same value as `montant` above — the aggregate, not re-derived. */
    totalMontant: string;
  };
};

/**
 * The list query surface, mirroring `IndexAgentStockReturnRequest`'s own
 * validator exactly (verified from source): `status`, `commercial_id`,
 * `manager_id`, `sort` (`created_at`|`return_number`), `direction`. NO
 * `per_page` CONTROL — `per_page` is accepted but this screen does not
 * expose one, the same "don't build a control for an accepted-but-unneeded
 * parameter" restraint Deposits' own list already applies; the backend's
 * own default (15) applies when omitted.
 */
export type AgentStockReturnListParams = {
  page: number;
  status: AgentStockReturnStatus | "";
  commercialId: string;
  managerId: string;
  sort: "created_at" | "return_number" | "";
  direction: "asc" | "desc" | "";
};

export const AGENT_STOCK_RETURN_LIST_DEFAULTS: AgentStockReturnListParams = {
  page: 1,
  status: "",
  commercialId: "",
  managerId: "",
  sort: "",
  direction: "",
};
