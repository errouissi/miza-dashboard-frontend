import { z } from "zod";

/**
 * The Create Bon form (roadmap M5, Phase 5) — `POST /admin/bons`. HEADER
 * FIELDS ONLY — lines are added afterward, on the detail page, same
 * "draft -> add lines -> validate" sequencing every prior Stock create
 * form already established.
 *
 * FIELDS VERIFIED FRESH FROM `StoreBonRequest`'s OWN VALIDATOR:
 *
 *   'supplier_id' => 'required|integer|exists:suppliers,id'
 *   'company_id'  => 'required|integer|exists:companies,id'
 *   'bon_number'  => 'required|string|max:191|unique:bons,bon_number'
 *   'notes'       => 'nullable|string|max:1000'
 *   'evidence'    => 'required|file|mimes:jpeg,png,jpg,pdf|max:5120'
 *   'received_at' => 'nullable|date' PLUS a custom Closure rule refusing
 *                    a FUTURE date — mirrored here, not invented.
 *
 * THIS IS THE FIRST STOCK RESOURCE WITH A REQUIRED FILE UPLOAD — reuses
 * Money's own established `FormData` + `FileUploadField` pattern
 * (`create-cheque.ts`'s own shape), NOT the M3.6 onboarding wizard's.
 * `max:5120` IS KILOBYTES, i.e. 5MB — a DIFFERENT cap from Cheques' own
 * 2MB `photo_cheque`; not copied from that precedent.
 *
 * `bon_number` IS `max:191`, matching Allocation's own `allocation_number`
 * cap, NOT Transfer's `max:255`.
 *
 * `supplierId`/`companyId` HAVE NO CLIENT-SIDE RE-CHECK OF "is this
 * active" — both pickers (`useSupplierOptionsQuery`/`useCompanyOptionsQuery`)
 * already only ever offer active rows server-side, so a second
 * client-side check would be dead code, same reasoning already applied to
 * Allocation's own company picker.
 */

export const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export const EVIDENCE_ACCEPT =
  ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

/** Today's own date, `YYYY-MM-DD`, in the operator's local timezone — mirrors the backend's own `Carbon::parse($value)->isFuture()` check as closely as a browser-local comparison can. */
function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const shape = {
  bonNumber: z.string().trim(),
  supplierId: z.string().trim(),
  companyId: z.string().trim(),
  notes: z.string().trim(),
  /** `""` = omitted, matching `nullable|date`. */
  receivedAt: z.string().trim(),
  evidence: z.custom<File | null>((value) => value === null || value instanceof File),
};

function checkEvidenceConstraints(ctx: z.RefinementCtx, file: File) {
  if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
    ctx.addIssue({
      code: "custom",
      message: "File must be 5MB or smaller.",
      path: ["evidence"],
    });
  }
  if (!(EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) {
    ctx.addIssue({
      code: "custom",
      message: "Unsupported file type.",
      path: ["evidence"],
    });
  }
}

export const createBonSchema = z.object(shape).superRefine((data, ctx) => {
  if (!data.bonNumber) {
    ctx.addIssue({
      code: "custom",
      message: "Bon number is required.",
      path: ["bonNumber"],
    });
  } else if (data.bonNumber.length > 191) {
    ctx.addIssue({
      code: "custom",
      message: "Bon number must be 191 characters or fewer.",
      path: ["bonNumber"],
    });
  }

  if (!data.supplierId) {
    ctx.addIssue({
      code: "custom",
      message: "Supplier is required.",
      path: ["supplierId"],
    });
  }

  if (!data.companyId) {
    ctx.addIssue({
      code: "custom",
      message: "Company is required.",
      path: ["companyId"],
    });
  }

  if (data.notes.length > 1000) {
    ctx.addIssue({
      code: "custom",
      message: "Notes must be 1000 characters or fewer.",
      path: ["notes"],
    });
  }

  if (data.receivedAt && data.receivedAt > todayDateString()) {
    ctx.addIssue({
      code: "custom",
      message: "Received date must not be in the future.",
      path: ["receivedAt"],
    });
  }

  if (!data.evidence) {
    ctx.addIssue({
      code: "custom",
      message: "Evidence is required.",
      path: ["evidence"],
    });
  } else {
    checkEvidenceConstraints(ctx, data.evidence);
  }
});

export type CreateBonFormValues = z.infer<typeof createBonSchema>;

export const defaultCreateBonValues: CreateBonFormValues = {
  bonNumber: "",
  supplierId: "",
  companyId: "",
  notes: "",
  receivedAt: "",
  evidence: null,
};
