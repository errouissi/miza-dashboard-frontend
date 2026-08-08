import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * An Allocation — the fourth Stock resource (roadmap M5, Phase 4). A
 * company hands grattage stock DOWN to one of its managers. Same
 * `draft -> add lines -> validate` lifecycle shape as Agent Stock Returns
 * and Agent Transfers, but its binding pair and its money semantics are
 * BOTH genuinely different — verified fresh from source
 * (`AllocationController`, `AllocationResource`, the `Allocation` model,
 * its FormRequests, `AllocationService`, `StockService::validateAllocation`)
 * per ADR-0022, NOT copied from Return's/Transfer's own model and edited:
 *
 * THE BINDING PAIR IS `company_id` + `agent_id` (role=manager) — NOT a
 * manager<->commercial pair. There is no cascading picker here (ADR-0021
 * already ruled this out as a third consumer of
 * `ReturnManagerCommercialField`/`TransferManagerCommercialField`); the
 * create form's own agent picker is a plain, backend-filtered
 * (`status=active`) manager select, no cascade.
 *
 * `montant` IS LOAD-BEARING (diverges from BOTH Return's and Transfer's own
 * metadata-only `montant`) — `SUM(line.unit_cost * line.quantity)`,
 * recomputed server-side on every line mutation, and it is the REAL GATE at
 * validate time: `StockService::validateAllocation` refuses
 * (`ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY`) when it exceeds the recipient
 * manager's available grattage-deposit capacity. Still a `decimal:2`-cast
 * STRING — rendered verbatim, never parsed, same discipline as Return's/
 * Transfer's own.
 *
 * THE ONLY ALLOCATION-ONLY GATE IS THIS SAME `ALLOCATION_EXCEEDS_DEPOSIT_
 * CAPACITY` CHECK — RE-VERIFIED FRESH FROM SOURCE against backend commit
 * `9af5d00` (`feat(allocation): settlement-aware Company -> Manager
 * grattage capacity`), which REMOVED the team-wide hard block this file
 * previously documented (`ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` —
 * the exception class was deleted outright and can never be thrown again).
 * The eligible validated-grattage-deposit pool behind the CAPACITY
 * FORMULA was widened instead — `agent_id IN {manager, team commercials}`,
 * not just the manager's own deposits — so a commercial's VALIDATED
 * grattage settlement now restores the manager's own allocation capacity
 * exactly like the manager's own deposit always did. An UNDISCHARGED
 * commercial obligation restores ZERO capacity but is never, by itself, a
 * refusal reason (a real product change, not a bug fix — see
 * `docs/architecture-roadmap.md` §2.9 amendment, backend repo). This gate
 * is REACTIVE ONLY — no proactive capacity read exists (BC-AA stays
 * partially open), same restraint Transfer's own
 * `AGENT_TRANSFER_EXCEEDS_CAPACITY` still has. A proactive Grattage
 * restock-gate integration briefly lived on `AllocationDetailPage` (M6
 * Phase 3) and was REMOVED once this backend contract changed — the
 * backend's own `computeGrattageRestockGate()` docblock now explicitly
 * states its `restock_gate` field is "NOT AUTHORITATIVE" for a manager.
 * Do not re-add a client-side capacity derivation from deposits/invoices/
 * movements — the backend is the sole authority for this number, and
 * currently exposes it only reactively, inside this exception's own
 * `context.available`. Transfer's own equivalent gate
 * (`TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`, still a hard,
 * unchanged block) is unaffected by any of this.
 *
 * NO DATE FIELD — unlike Transfer's own `transfer_date`, `StoreAllocationRequest`
 * has no date field at all (verified from source); not omitted by oversight.
 *
 * `company`/`creator`/`approver` USE `{id, name}` (`idName()` in
 * `AllocationResource`) — `agent` uses `{id, nom, prenom}` (`agentShape()`,
 * Agent's actual columns, no `name` column) — same split Transfer's own
 * `manager`/`commercial` vs. `creator`/`approver` already established.
 *
 * `consumptions` (THE DEPOSIT-FUNDING AUDIT TRAIL) IS DELIBERATELY NOT
 * MODELLED — verified from source that `AllocationController::show()` NEVER
 * eager-loads the `consumptions` relation; only `validateAllocation()`'s own
 * response does (`whenLoaded('consumptions', ...)`). A field present on
 * exactly one response and absent on every subsequent read (including a
 * page reload right after validating) has no screen that can reliably read
 * it — modelling it would be exactly the speculation ADR-0008/D-11 forbid.
 *
 * CANCELLATION FIELDS (`cancelled_by`/`cancelled_at`/`cancellation_reason`)
 * ARE DELIBERATELY NOT MODELLED — the model's own docblock states they are
 * "RESERVED for Phase 4D" and always null in this phase, same reasoning
 * Return's/Transfer's own model already applied.
 *
 * `lines`/`validationSummary` ARE OPTIONAL ON THE TYPE — `whenLoaded` means
 * they are PRESENT on `show()`/every line mutation's response, ABSENT on
 * `index()` rows, same "present on show, absent on list" modelling
 * Return's/Transfer's own type already established.
 *
 * `validationSummary`'s OWN KEYS — `{lineCount, totalQuantity, montant}` —
 * verified directly from `AllocationResource::toArray()`'s own
 * `validation_summary` closure (`line_count`, `total_quantity`, `montant`).
 * IDENTICAL SHAPE TO TRANSFER'S OWN (not Return's `{totalLines,
 * totalQuantity, totalMontant}`) — a coincidence of two independently
 * verified contracts, not assumed from either.
 */

export const ALLOCATION_STATUSES = ["draft", "validated", "cancelled"] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

/** `cancelled` is modelled in the enum (the column value exists, per `IndexAllocationRequest`'s own filter) even though no code path sets it yet in this phase — mirrors Return's/Transfer's own restraint. */
export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  cancelled: "Cancelled",
};

export const ALLOCATION_STATUS_TONES: Record<AllocationStatus, StatusTone> = {
  draft: "warning",
  validated: "success",
  cancelled: "muted",
};

export type AllocationLine = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  /** A `decimal:2`-cast STRING — render verbatim. Required, not nullable (diverges from Bon's own line). */
  unitCost: string;
  notes: string | null;
};

export type Allocation = {
  id: number;
  /** BACKEND-GENERATED (`ALLOC-{ULID}`, `AllocationService::createDraft` via `DocumentNumberService`) — never a create-form input; see `model/create-allocation.ts`'s own docblock. */
  allocationNumber: string;
  status: AllocationStatus;
  /** LOAD-BEARING, `decimal:2`-cast STRING — see the module docblock. */
  montant: string;
  notes: string | null;
  companyId: number;
  companyName: string;
  agentId: number;
  agentName: string;
  createdByName: string;
  approvedByName: string | null;
  /** ISO-8601, or `null` while still a draft. */
  approvedAt: string | null;
  createdAt: string;
  /** Present on `show()` and every line-mutation response; absent on `index()` rows. */
  lines?: AllocationLine[];
  validationSummary?: {
    lineCount: number;
    totalQuantity: number;
    /** Same value as `montant` above — the aggregate, not re-derived. */
    montant: string;
  };
};

/**
 * The list query surface, mirroring `IndexAllocationRequest`'s own validator
 * exactly (verified from source): `status`, `agent_id`, `company_id`,
 * `sort` (`created_at`|`allocation_number`), `direction`. NO PER-PAGE
 * CONTROL — the endpoint accepts one (`max:100`), but this restraint
 * mirrors Return's/Transfer's own: no control for an accepted-but-unexposed
 * parameter; the backend's own default (15) applies when omitted.
 */
export type AllocationListParams = {
  page: number;
  status: AllocationStatus | "";
  agentId: string;
  companyId: string;
  sort: "created_at" | "allocation_number" | "";
  direction: "asc" | "desc" | "";
};

export const ALLOCATION_LIST_DEFAULTS: AllocationListParams = {
  page: 1,
  status: "",
  agentId: "",
  companyId: "",
  sort: "",
  direction: "",
};
