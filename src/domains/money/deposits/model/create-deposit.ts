import { z } from "zod";
import { DEPOSIT_METHODS, DEPOSIT_PROOF_TYPES, DEPOSIT_TYPES } from "./deposit";

/**
 * The Create Deposit form (roadmap M4.3 Phase 4) — `POST /admin/depos`.
 *
 * FIELDS VERIFIED FRESH FROM `DepoController::store`'s OWN VALIDATOR, not
 * carried forward from any prior discovery pass:
 *
 *   'agent_id'       => 'required|exists:agents,id',
 *   'deposit_method' => 'required|in:bank,cash,other',
 *   'amount'         => 'required|numeric|min:0.01',
 *   'proof_image'    => 'required|image|mimes:jpeg,png,jpg|max:5120',
 *   'receipt_number' => ['nullable','string', Rule::unique('deposits','receipt_number')],
 *   'type'           => 'nullable|in:grattage,rapped',                    // defaults 'rapped'
 *   'proof_type'     => 'nullable|in:bank_receipt,whatsapp_confirmation', // defaults 'bank_receipt'
 *   'bank_name'      => 'nullable|string|max:255',
 *
 * `bank_name` STAYS ALWAYS VISIBLE, deliberately NOT conditioned on
 * `depositMethod` — confirmed decision: the backend does not couple the
 * two either, and adding a UI-only conditional would be inventing UX
 * behavior neither Product nor the backend asked for.
 *
 * `amount` IS NOT FREELY EDITABLE — the real constraint `store()` enforces
 * is an EXACT match (rapped: the agent's current `cash`; grattage: the
 * agent's full outstanding grattage total), neither of which the operator
 * can know without a read the create PAGE performs (see
 * `pages/create-deposit-page.tsx`'s own docblock). This schema still
 * validates `amount` against the backend's OWN baseline rule
 * (`numeric|min:0.01`) as a safety net, but the page itself is what
 * guarantees a resolved, correct value ever reaches this field.
 */

/** Backend: `max:5120` (KB) = 5MB. */
export const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
/** Backend: `mimes:jpeg,png,jpg` — same accepted types as Cheques' own photo. */
export const DEPOSIT_PROOF_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const DEPOSIT_PROOF_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

const shape = {
  /** A Manager or Commercial id — see `create-deposit-agent-field.tsx`. */
  agentId: z.string().trim(),
  type: z.enum(DEPOSIT_TYPES),
  /**
   * A plain numeric string — system-populated by the create page from the
   * agent-cash/grattage-outstanding read, never typed by the operator. See
   * the module docblock.
   */
  amount: z.string().trim(),
  /** No default exists server-side (unlike `type`/`proofType`) — starts unselected (""). */
  depositMethod: z.union([z.enum(DEPOSIT_METHODS), z.literal("")]),
  receiptNumber: z.string().trim(),
  bankName: z.string().trim(),
  proofType: z.enum(DEPOSIT_PROOF_TYPES),
  photo: z.custom<File | null>((value) => value === null || value instanceof File),
};

function checkPhotoConstraints(ctx: z.RefinementCtx, file: File) {
  if (file.size > MAX_PROOF_SIZE_BYTES) {
    ctx.addIssue({
      code: "custom",
      message: "File must be 5MB or smaller.",
      path: ["photo"],
    });
  }
  if (!(DEPOSIT_PROOF_MIME_TYPES as readonly string[]).includes(file.type)) {
    ctx.addIssue({ code: "custom", message: "Unsupported file type.", path: ["photo"] });
  }
}

export const createDepositSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.agentId) {
    ctx.addIssue({ code: "custom", message: "Agent is required.", path: ["agentId"] });
  }

  if (!data.depositMethod) {
    ctx.addIssue({
      code: "custom",
      message: "Deposit method is required.",
      path: ["depositMethod"],
    });
  }

  if (!data.amount) {
    ctx.addIssue({ code: "custom", message: "Amount is required.", path: ["amount"] });
  } else if (Number.isNaN(Number(data.amount))) {
    ctx.addIssue({ code: "custom", message: "Enter a valid number.", path: ["amount"] });
  } else if (Number(data.amount) < 0.01) {
    ctx.addIssue({
      code: "custom",
      message: "Amount must be at least 0.01.",
      path: ["amount"],
    });
  }

  if (!data.photo) {
    ctx.addIssue({
      code: "custom",
      message: "Proof image is required.",
      path: ["photo"],
    });
  } else {
    checkPhotoConstraints(ctx, data.photo);
  }
});

export type CreateDepositFormValues = z.infer<typeof createDepositSchema>;

export const defaultCreateDepositValues: CreateDepositFormValues = {
  agentId: "",
  type: "rapped",
  amount: "",
  depositMethod: "",
  receiptNumber: "",
  bankName: "",
  proofType: "bank_receipt",
  photo: null,
};
