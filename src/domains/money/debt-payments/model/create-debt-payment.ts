import { z } from "zod";

/**
 * The Create (Record) Debt Payment form (roadmap M4) — `POST /admin/debt-payments`.
 *
 * FIELDS VERIFIED FRESH FROM `DebtPaymentController::store`'s OWN VALIDATOR:
 *
 *   'amount'         => 'required|numeric|min:0.01' (plus a closure rule:
 *                        `bccomp($value, $admin->debt, 2) > 0` fails with
 *                        "Le montant ne peut pas dépasser votre dette
 *                        actuelle (...)")
 *   'proof_image'    => 'required|image|mimes:jpeg,png,jpg,pdf|max:5120'
 *   'receipt_number' => ['required','string', Rule::unique('debt_payments','receipt_number')]
 *
 * THE CEILING (`amount` MUST NOT exceed the admin's current `debt`) IS
 * DELIBERATELY NOT PART OF THIS SCHEMA. Per explicit instruction: the
 * backend stays the sole source of truth for this rule; the client-side
 * check is a UX mirror only, computed in `create-debt-payment-page.tsx`
 * against the already-fetched `current_debt` summary value (NOT baked into
 * `superRefine` here, which would make the schema itself depend on
 * external, asynchronously-fetched data no other schema in this codebase
 * needs) — the same "caller computes its own extra validity, independent of
 * the static schema" pattern `ApproveChequeDialog`'s `confirmDisabled`
 * already established for Cheques' allocation-sum rule. Whatever the
 * client believes the ceiling to be, submission always goes through this
 * schema's own baseline `numeric|min:0.01` check and then the real backend
 * validator — a stale or wrong client-side ceiling can only ever produce an
 * honest 422, never a bad write.
 *
 * `receipt_number` IS REQUIRED here, unlike Cheques'/Deposits' own optional
 * receipt fields — mirrored exactly as `store()`'s validator states, not
 * assumed from either prior resource's shape.
 *
 * PROOF ACCEPTS IMAGE **OR PDF** (`mimes:jpeg,png,jpg,pdf`) — the one field
 * shape that differs from Cheques' (image-only) and Deposits' (image-only)
 * own proof uploads. Named `DEBT_PAYMENT_PROOF_*` and kept domain-local,
 * mirroring the SAME `application/pdf` + image MIME set
 * `agent-onboarding/model/agent-onboarding.ts`'s own `DOCUMENT_MIME_TYPES`
 * already uses for its non-photo document fields — not a shared constant
 * (ADR-0006, one same-shape constant in a second domain is not yet
 * Rule-of-Three evidence), just the same reasoning applied independently.
 */

/** Backend: `max:5120` (KB) = 5MB. */
export const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
/** Backend: `mimes:jpeg,png,jpg,pdf` — image OR PDF, unlike Cheques'/Deposits' image-only proofs. */
export const DEBT_PAYMENT_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export const DEBT_PAYMENT_PROOF_ACCEPT =
  ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

const shape = {
  /** A plain numeric string, matching the backend's own `numeric|min:0.01`. */
  amount: z.string().trim(),
  receiptNumber: z.string().trim(),
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
  if (!(DEBT_PAYMENT_PROOF_MIME_TYPES as readonly string[]).includes(file.type)) {
    ctx.addIssue({ code: "custom", message: "Unsupported file type.", path: ["photo"] });
  }
}

export const createDebtPaymentSchema = z.object(shape).superRefine((data, ctx) => {
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

  if (!data.receiptNumber) {
    ctx.addIssue({
      code: "custom",
      message: "Receipt number is required.",
      path: ["receiptNumber"],
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

export type CreateDebtPaymentFormValues = z.infer<typeof createDebtPaymentSchema>;

export const defaultCreateDebtPaymentValues: CreateDebtPaymentFormValues = {
  amount: "",
  receiptNumber: "",
  photo: null,
};
