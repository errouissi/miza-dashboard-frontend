import { z } from "zod";

/**
 * The Create Allocation form (roadmap M5, Phase 4) —
 * `POST /admin/allocations`. HEADER FIELDS ONLY — lines are added
 * afterward, on the detail page, same "draft -> add lines -> validate"
 * sequencing Return's/Transfer's own create forms already established.
 *
 * FIELDS VERIFIED FRESH FROM `StoreAllocationRequest`'s OWN VALIDATOR:
 *
 *   'allocation_number' => 'required|string|max:191|unique:allocations,allocation_number'
 *   'company_id'         => 'required|integer|exists:companies,id (active)'
 *   'agent_id'            => 'required|integer|exists:agents,id (active, role=manager)'
 *   'notes'               => 'nullable|string|max:1000'
 *
 * NO DATE FIELD — unlike `create-agent-transfer.ts`'s own `transferDate`,
 * `StoreAllocationRequest` has no date field at all; not an omission.
 *
 * `allocation_number` IS `max:191`, NOT `max:255` LIKE TRANSFER'S OWN
 * `transfer_number` — a genuine, verified divergence, not normalized away.
 *
 * `companyId` HAS NO CLIENT-SIDE RE-CHECK OF "is this company active" — the
 * picker (`useCompanyOptionsQuery`) already only ever offers active
 * companies, since `GET /admin/companies` filters to `active=true`
 * server-side. A second client-side check would be dead code, not a safety
 * net, same reasoning already applied to the (ruled-out-here) manager/
 * commercial binding check in Return's/Transfer's own create forms.
 */

const shape = {
  allocationNumber: z.string().trim(),
  companyId: z.string().trim(),
  agentId: z.string().trim(),
  notes: z.string().trim(),
};

export const createAllocationSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.allocationNumber) {
    ctx.addIssue({
      code: "custom",
      message: "Allocation number is required.",
      path: ["allocationNumber"],
    });
  } else if (data.allocationNumber.length > 191) {
    ctx.addIssue({
      code: "custom",
      message: "Allocation number must be 191 characters or fewer.",
      path: ["allocationNumber"],
    });
  }

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
  allocationNumber: "",
  companyId: "",
  agentId: "",
  notes: "",
};
