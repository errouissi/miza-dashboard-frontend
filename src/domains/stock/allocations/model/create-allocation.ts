import { z } from "zod";

/**
 * The Create Allocation form (roadmap M5, Phase 4) —
 * `POST /admin/allocations`. HEADER FIELDS ONLY — lines are added
 * afterward, on the detail page, same "draft -> add lines -> validate"
 * sequencing Return's/Transfer's own create forms already established.
 *
 * FIELDS VERIFIED FRESH FROM `StoreAllocationRequest`'s OWN VALIDATOR:
 *
 *   'company_id' => 'required|integer|exists:companies,id (active)'
 *   'agent_id'    => 'required|integer|exists:agents,id (active, role=manager)'
 *   'notes'       => 'nullable|string|max:1000'
 *
 * NO `allocation_number` FIELD — `allocation_number` is now BACKEND-
 * GENERATED (`AllocationService::createDraft`, via `DocumentNumberService`,
 * `ALLOC-{ULID}`) and was removed from `StoreAllocationRequest`'s own
 * rules entirely; any value a caller supplied would simply be ignored even
 * before this change removed the field client-side. There is therefore no
 * client-side "duplicate allocation number" case to guard against anymore
 * — a collision (bounded at 3 server-side regeneration attempts) is
 * astronomically unlikely and not user-facing in any way this form could
 * meaningfully react to.
 *
 * NO DATE FIELD — unlike `create-agent-transfer.ts`'s own `transferDate`,
 * `StoreAllocationRequest` has no date field at all; not an omission.
 *
 * `companyId` HAS NO CLIENT-SIDE RE-CHECK OF "is this company active" — the
 * picker (`useCompanyOptionsQuery`) already only ever offers active
 * companies, since `GET /admin/companies` filters to `active=true`
 * server-side. A second client-side check would be dead code, not a safety
 * net, same reasoning already applied to the (ruled-out-here) manager/
 * commercial binding check in Return's/Transfer's own create forms.
 */

const shape = {
  companyId: z.string().trim(),
  agentId: z.string().trim(),
  notes: z.string().trim(),
};

export const createAllocationSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.companyId) {
    ctx.addIssue({
      code: "custom",
      message: "Company is required.",
      path: ["companyId"],
    });
  }

  if (!data.agentId) {
    ctx.addIssue({
      code: "custom",
      message: "Manager is required.",
      path: ["agentId"],
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

export type CreateAllocationFormValues = z.infer<typeof createAllocationSchema>;

export const defaultCreateAllocationValues: CreateAllocationFormValues = {
  companyId: "",
  agentId: "",
  notes: "",
};
