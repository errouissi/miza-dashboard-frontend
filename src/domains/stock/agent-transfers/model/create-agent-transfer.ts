import { z } from "zod";

/**
 * The Create Agent Transfer form (roadmap M5, Phase 2) —
 * `POST /admin/agent-transfers`. HEADER FIELDS ONLY — lines are added
 * afterward, on the detail page, same "draft -> add lines -> validate"
 * sequencing Agent Stock Return's own create form already established.
 *
 * FIELDS VERIFIED FRESH FROM `StoreAgentTransferRequest`'s OWN VALIDATOR:
 *
 *   'manager_id'    => 'required|integer|exists:agents,id (active, role=manager)'
 *   'commercial_id' => 'required|integer|exists:agents,id (active, role=commercial)'
 *   'notes'         => 'nullable|string|max:1000'
 *   'transfer_date' => 'nullable|date'
 *
 * NO `transfer_number` FIELD — `transfer_number` is now BACKEND-GENERATED
 * (`AgentTransferService::createDraft`, via `DocumentNumberService`,
 * `TRF-{ULID}`) and was removed from `StoreAgentTransferRequest`'s own
 * rules entirely; any value a caller supplied would simply be ignored even
 * before this change removed the field client-side. There is therefore no
 * client-side "duplicate transfer number" case to guard against anymore —
 * a collision (bounded at 3 server-side regeneration attempts) is
 * astronomically unlikely and not user-facing in any way this form could
 * meaningfully react to.
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
  managerId: z.string().trim(),
  commercialId: z.string().trim(),
  notes: z.string().trim(),
  /** `""` = omitted. A plain `YYYY-MM-DD` (or any backend-parseable date string), matching `nullable|date`. */
  transferDate: z.string().trim(),
};

export const createAgentTransferSchema = z.object(shape).superRefine((data, ctx) => {
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
  managerId: "",
  commercialId: "",
  notes: "",
  transferDate: "",
};
