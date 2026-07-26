import { z } from "zod";

/**
 * The Create Agent Stock Return form (roadmap M5, Phase 1) —
 * `POST /admin/agent-stock-returns`. HEADER FIELDS ONLY — lines are added
 * afterward, on the detail page, matching the roadmap's own "draft -> add
 * lines -> validate" sequencing; there is no reason to force every line
 * into one combined submission the backend does not require either (lines
 * are their own nested endpoint, added one at a time).
 *
 * FIELDS VERIFIED FRESH FROM `StoreAgentStockReturnRequest`'s OWN
 * VALIDATOR:
 *
 *   'return_number' => 'required|string|max:255|unique:agent_stock_returns,return_number'
 *   'commercial_id' => 'required|integer|exists:agents,id (active, role=commercial)'
 *   'manager_id'    => 'required|integer|exists:agents,id (active, role=manager)'
 *   'notes'         => 'nullable|string|max:1000'
 *   'return_date'   => 'nullable|date'
 *
 * THE CROSS-FIELD BINDING RULE (`commercial.manager_id === manager_id`,
 * re-verified from `StoreAgentStockReturnRequest::withValidator`) IS
 * DELIBERATELY NOT MIRRORED HERE AS A ZOD RULE — it is guaranteed BY
 * CONSTRUCTION instead: `ReturnManagerCommercialField` (this domain's own
 * cascading picker) only ever offers commercials already scoped to the
 * selected manager (via `GET /admin/agents/{manager}/sub-data`), so a
 * mismatched pair cannot be assembled through this form's own UI. A
 * client-side re-check of a fact the picker already guarantees would be
 * dead code, not a safety net — the real safety net is the backend's own
 * validator, re-asserted again at validate time under a row lock
 * (`StockService::validateReturn`).
 */

const shape = {
  returnNumber: z.string().trim(),
  managerId: z.string().trim(),
  commercialId: z.string().trim(),
  notes: z.string().trim(),
  /** `""` = omitted. A plain `YYYY-MM-DD` (or any backend-parseable date string), matching `nullable|date`. */
  returnDate: z.string().trim(),
};

export const createAgentStockReturnSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.returnNumber) {
    ctx.addIssue({
      code: "custom",
      message: "Return number is required.",
      path: ["returnNumber"],
    });
  } else if (data.returnNumber.length > 255) {
    ctx.addIssue({
      code: "custom",
      message: "Return number must be 255 characters or fewer.",
      path: ["returnNumber"],
    });
  }

  if (!data.managerId) {
    ctx.addIssue({
      code: "custom",
      message: "Manager is required.",
      path: ["managerId"],
    });
  }

  if (!data.commercialId) {
    ctx.addIssue({
      code: "custom",
      message: "Commercial is required.",
      path: ["commercialId"],
    });
  }

  if (data.notes.length > 1000) {
    ctx.addIssue({
      code: "custom",
      message: "Notes must be 1000 characters or fewer.",
      path: ["notes"],
    });
  }
});

export type CreateAgentStockReturnFormValues = z.infer<
  typeof createAgentStockReturnSchema
>;

export const defaultCreateAgentStockReturnValues: CreateAgentStockReturnFormValues = {
  returnNumber: "",
  managerId: "",
  commercialId: "",
  notes: "",
  returnDate: "",
};
