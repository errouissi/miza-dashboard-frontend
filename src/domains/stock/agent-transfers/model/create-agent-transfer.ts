import { z } from "zod";

/**
 * The Create Agent Transfer form (roadmap M5, Phase 2) —
 * `POST /admin/agent-transfers`. HEADER FIELDS ONLY — lines are added
 * afterward, on the detail page, same "draft -> add lines -> validate"
 * sequencing Agent Stock Return's own create form already established.
 *
 * FIELDS VERIFIED FRESH FROM `StoreAgentTransferRequest`'s OWN VALIDATOR:
 *
 *   'transfer_number' => 'required|string|max:255|unique:agent_transfers,transfer_number'
 *   'manager_id'       => 'required|integer|exists:agents,id (active, role=manager)'
 *   'commercial_id'    => 'required|integer|exists:agents,id (active, role=commercial)'
 *   'notes'            => 'nullable|string|max:1000'
 *   'transfer_date'    => 'nullable|date'
 *
 * THE CROSS-FIELD BINDING RULE (`commercial.manager_id === manager_id`,
 * re-verified from `StoreAgentTransferRequest::withValidator`) IS
 * DELIBERATELY NOT MIRRORED HERE AS A ZOD RULE — same reasoning Return's own
 * form already established: it is guaranteed BY CONSTRUCTION instead.
 * `TransferManagerCommercialField` (this domain's own cascading picker) only
 * ever offers commercials already scoped to the selected manager (via
 * `GET /admin/agents/{manager}/sub-data`), so a mismatched pair cannot be
 * assembled through this form's own UI. A client-side re-check of a fact the
 * picker already guarantees would be dead code, not a safety net — the real
 * safety net is the backend's own validator, re-asserted again at validate
 * time under a row lock (`StockService::validateTransfer`).
 */

const shape = {
  transferNumber: z.string().trim(),
  managerId: z.string().trim(),
  commercialId: z.string().trim(),
  notes: z.string().trim(),
  /** `""` = omitted. A plain `YYYY-MM-DD` (or any backend-parseable date string), matching `nullable|date`. */
  transferDate: z.string().trim(),
};

export const createAgentTransferSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.transferNumber) {
    ctx.addIssue({
      code: "custom",
      message: "Transfer number is required.",
      path: ["transferNumber"],
    });
  } else if (data.transferNumber.length > 255) {
    ctx.addIssue({
      code: "custom",
      message: "Transfer number must be 255 characters or fewer.",
      path: ["transferNumber"],
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

export type CreateAgentTransferFormValues = z.infer<typeof createAgentTransferSchema>;

export const defaultCreateAgentTransferValues: CreateAgentTransferFormValues = {
  transferNumber: "",
  managerId: "",
  commercialId: "",
  notes: "",
  transferDate: "",
};
