import { z } from "zod";

/**
 * The Create Cheque form (roadmap M4.2 Phase 3A) — `POST /admin/cheques`.
 *
 * FOUR FIELDS ONLY, verified directly from `ChequeController::store`'s own
 * validator (not derived from the roadmap's prose, and not the same field
 * set first proposed for this task):
 *
 *   'agent_id'     => 'required|exists:agents,id',
 *   'amount'       => 'required|numeric|min:0.01',
 *   'num_cheque'   => 'required|string|max:255|regex:/^[A-Za-z0-9_-]+$/|unique:cheques,num_cheque',
 *   'photo_cheque' => 'required|image|mimes:jpeg,png,jpg|max:2048',
 *
 * There is no `banque`/`date_emission` (or any bank/issue-date) column
 * anywhere in the `cheques` migration, the `Cheque` model's `$fillable`, or
 * this validator — confirmed by reading all three directly. ADR-0009
 * forbids exposing a capability the backend does not have, so this form has
 * no such fields, even though they were named in this task's first draft.
 */

/** Backend: `max:2048` (KB). */
export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
/** Backend: `mimes:jpeg,png,jpg` — no PDF, unlike Agent Onboarding's documents. */
export const CHEQUE_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const CHEQUE_PHOTO_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

/** `num_cheque`'s own backend regex, mirrored exactly — not invented. */
const NUM_CHEQUE_REGEX = /^[A-Za-z0-9_-]+$/;

const shape = {
  /** A Manager or Commercial id — see `create-cheque-agent-field.tsx`. */
  agentId: z.string().trim(),
  /** A plain numeric string, matching the backend's own `numeric|min:0.01`. */
  amount: z.string().trim(),
  numCheque: z.string().trim().max(255),
  photo: z.custom<File | null>((value) => value === null || value instanceof File),
};

function checkPhotoConstraints(ctx: z.RefinementCtx, file: File) {
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    ctx.addIssue({
      code: "custom",
      message: "File must be 2MB or smaller.",
      path: ["photo"],
    });
  }
  if (!(CHEQUE_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    ctx.addIssue({ code: "custom", message: "Unsupported file type.", path: ["photo"] });
  }
}

export const createChequeSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.agentId) {
    ctx.addIssue({ code: "custom", message: "Agent is required.", path: ["agentId"] });
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

  if (!data.numCheque) {
    ctx.addIssue({
      code: "custom",
      message: "Cheque number is required.",
      path: ["numCheque"],
    });
  } else if (!NUM_CHEQUE_REGEX.test(data.numCheque)) {
    ctx.addIssue({
      code: "custom",
      message: "Only letters, numbers, hyphens and underscores are allowed.",
      path: ["numCheque"],
    });
  }

  if (!data.photo) {
    ctx.addIssue({
      code: "custom",
      message: "Cheque photo is required.",
      path: ["photo"],
    });
  } else {
    checkPhotoConstraints(ctx, data.photo);
  }
});

export type CreateChequeFormValues = z.infer<typeof createChequeSchema>;

export const defaultCreateChequeValues: CreateChequeFormValues = {
  agentId: "",
  amount: "",
  numCheque: "",
  photo: null,
};
