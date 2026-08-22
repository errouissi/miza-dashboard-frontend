import { z } from "zod";
import { DEPOSIT_PROOF_TYPES, DEPOSIT_TYPES, type DepositProofType } from "./deposit";

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
 * `bank_name`/`receipt_number`/`proof_type` ARE NOW CONDITIONED ON
 * `depositMethod` (Manager Demo Readiness, Item 4 — this SUPERSEDES the
 * prior "always visible, never conditioned" decision recorded above the
 * page's own docblock; see `decisions.md`). The backend still does not
 * couple these fields to `deposit_method` itself (verified fresh from
 * `DepoController::store`'s validator — no `required_if`/`prohibited_if`
 * exists), so this is a FRONTEND-ONLY UX decision layered on top of an
 * unchanged, uncoupled backend contract: Cash hides Receipt Number/Bank
 * Name and fixes Proof Type to "Bank receipt"; Bank shows both and fixes
 * Proof Type to "WhatsApp confirmation". See `CREATABLE_DEPOSIT_METHODS`
 * below and `pages/create-deposit-page.tsx`'s own docblock for the full
 * behavior.
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

/**
 * Manager Demo Readiness, Item 4 — the create form offers only two of the
 * backend's three accepted `deposit_method` values (`deposit.ts`'s own
 * `DEPOSIT_METHODS` docblock: `required|in:bank,cash,other`). This is a
 * CREATE-FORM-LOCAL restriction, not a narrowing of the domain-wide enum —
 * `DEPOSIT_METHODS`/`DEPOSIT_METHOD_LABELS` stay a full three values so the
 * list filter and detail page can still display/filter a historical
 * `"other"` deposit correctly.
 */
export const CREATABLE_DEPOSIT_METHODS = ["cash", "bank"] as const;
export type CreatableDepositMethod = (typeof CREATABLE_DEPOSIT_METHODS)[number];

/**
 * Manager Demo Readiness, Item 4 — each creatable method fixes Proof Type
 * to exactly one value (the select renders only this one option per
 * method; see the create page). Corrected mapping, per manual-QA
 * correction (the original Item 4 wording had this reversed): Cash ->
 * "WhatsApp confirmation", Bank -> "Bank receipt". Verified fresh from
 * `DepoController::store`'s validator before this correction: neither
 * pairing is coupled to `deposit_method` server-side
 * (`proof_type => nullable|in:bank_receipt,whatsapp_confirmation`, no
 * `required_if`/`prohibited_if`), so both combinations are safely
 * frontend-only.
 */
export const PROOF_TYPE_FOR_METHOD: Record<CreatableDepositMethod, DepositProofType> = {
  cash: "whatsapp_confirmation",
  bank: "bank_receipt",
};

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
  /** No default exists server-side (unlike `type`/`proofType`) — starts unselected (""). Narrowed to the two creatable values — see `CREATABLE_DEPOSIT_METHODS` above. */
  depositMethod: z.union([z.enum(CREATABLE_DEPOSIT_METHODS), z.literal("")]),
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
