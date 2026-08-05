import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * An Agent Transfer — the second Stock resource (roadmap M5, Phase 2). A
 * manager hands grattage stock they hold DOWN to one of their own
 * commercials. Reverse direction of an Agent Stock Return, same lifecycle
 * shape as all four Stock movement types: draft -> add lines ->
 * irreversible validate. NO CANCEL — verified from source (`routes/api.php`'s
 * `agent-transfers` group has no `/cancel` route; only Bons have one today).
 *
 * CONTRACT VERIFIED FRESH FROM SOURCE this phase (`AgentTransferController`,
 * `AgentTransferResource`, the `AgentTransfer` model, its FormRequests) —
 * NOT copied from the Agent Stock Return model and edited (per this phase's
 * explicit decision #5):
 *
 * `montant` IS METADATA-ONLY — `SUM(line.unit_cost * line.quantity)`,
 * recomputed server-side on every line mutation for reporting and future
 * Phase 4D settlement valuation only. It gates nothing (the real gate is
 * the manager's stock floor, checked at validate time, PLUS the
 * commercial's remaining grattage capacity — a Transfer-only gate Return
 * does not have) and is NEVER a form input — `$fillable` on the model
 * confirms it is not settable from a request.
 *
 * `montant`/line `unitCost` ARE `decimal:2`-CAST STRINGS — same discipline
 * as `AgentStockReturn.montant`: rendered verbatim, never parsed.
 *
 * DATES ARE ISO-8601 (`created_at`/`updated_at`/`approved_at`) EXCEPT
 * `transfer_date`, a DATE-ONLY field surfaced as `YYYY-MM-DD` via
 * `toDateString()`, not a datetime.
 *
 * `manager`/`commercial` USE `{id, nom, prenom}` (Agent columns), NOT
 * `{id, name}` — confirmed from the Resource's own `agentShape()` helper.
 * `creator`/`approver` use `{id, name}` (User columns) via `idName()`.
 *
 * CANCELLATION FIELDS (`cancelled_by`/`cancelled_at`/`cancellation_reason`)
 * ARE DELIBERATELY NOT MODELLED — the model's own docblock states they are
 * "RESERVED for Phase 4D" and always null in this phase; modelling a field
 * with no possible non-null value and no screen that reads it is exactly
 * the speculation ADR-0008/D-11 forbid — same reasoning Return's own model
 * already applied.
 *
 * `lines`/`validationSummary` ARE OPTIONAL ON THE TYPE — `whenLoaded` means
 * they are PRESENT ON `show()`/every line mutation's response, ABSENT ON
 * `index()` rows — the same "present on show, absent on list" modelling
 * Return's own type already established.
 *
 * `validationSummary`'S OWN KEYS GENUINELY DIVERGE FROM RETURN'S —
 * `{lineCount, totalQuantity, montant}`, NOT Return's
 * `{totalLines, totalQuantity, totalMontant}` — verified directly from
 * `AgentTransferResource::toArray()`'s own `validation_summary` closure
 * (`line_count`, `total_quantity`, `montant`), not assumed to match.
 */

export const AGENT_TRANSFER_STATUSES = ["draft", "validated", "cancelled"] as const;
export type AgentTransferStatus = (typeof AGENT_TRANSFER_STATUSES)[number];

/** `cancelled` is modelled in the STATUS enum (the column value exists, per `IndexAgentTransferRequest`'s own filter) even though no code path sets it yet in this phase — a future cancel lifecycle writes to an already-correct type. */
export const AGENT_TRANSFER_STATUS_LABELS: Record<AgentTransferStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  cancelled: "Cancelled",
};

export const AGENT_TRANSFER_STATUS_TONES: Record<AgentTransferStatus, StatusTone> = {
  draft: "warning",
  validated: "success",
  cancelled: "muted",
};

export type AgentTransferLine = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  /** A `decimal:2`-cast STRING — render verbatim. */
  unitCost: string;
  notes: string | null;
};

export type AgentTransfer = {
  id: number;
  /** BACKEND-GENERATED (`TRF-{ULID}`, `AgentTransferService::createDraft` via `DocumentNumberService`) — never a create-form input; see `model/create-agent-transfer.ts`'s own docblock. */
  transferNumber: string;
  status: AgentTransferStatus;
  /** Metadata-only, `decimal:2`-cast STRING — see the module docblock. */
  montant: string;
  notes: string | null;
  /** `YYYY-MM-DD`, or `null` — a date-only field, not a datetime. */
  transferDate: string | null;
  managerId: number;
  managerName: string;
  commercialId: number;
  commercialName: string;
  createdByName: string;
  approvedByName: string | null;
  /** ISO-8601, or `null` while still a draft. */
  approvedAt: string | null;
  createdAt: string;
  /** Present on `show()` and every line-mutation response; absent on `index()` rows. */
  lines?: AgentTransferLine[];
  validationSummary?: {
    lineCount: number;
    totalQuantity: number;
    /** Same value as `montant` above — the aggregate, not re-derived. */
    montant: string;
  };
};

/**
 * The list query surface, mirroring `IndexAgentTransferRequest`'s own
 * validator exactly (verified from source): `status`, `manager_id`,
 * `commercial_id`, `sort` (`created_at`|`transfer_number`), `direction`. NO
 * `per_page` CONTROL — same "don't build a control for an accepted-but-
 * unneeded parameter" restraint Return's own list already applies; the
 * backend's own default (15) applies when omitted.
 */
export type AgentTransferListParams = {
  page: number;
  status: AgentTransferStatus | "";
  managerId: string;
  commercialId: string;
  sort: "created_at" | "transfer_number" | "";
  direction: "asc" | "desc" | "";
};

export const AGENT_TRANSFER_LIST_DEFAULTS: AgentTransferListParams = {
  page: 1,
  status: "",
  managerId: "",
  commercialId: "",
  sort: "",
  direction: "",
};
