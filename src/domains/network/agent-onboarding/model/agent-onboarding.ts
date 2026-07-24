import { z } from "zod";
import { parseMoney } from "@/shared/formatters";

/**
 * The M3.6 agent onboarding wizard — a NEW, dedicated domain (ADR-0012), not
 * hosted inside Managers or Commercials. `AgentController::store` creates
 * EITHER role through one endpoint, so this flow belongs to neither existing
 * domain — each of which owns its own mapper/key-factory per ADR-0012, and
 * forcing this into one would misrepresent which domain actually owns it.
 *
 * CONTRACT VERIFIED INDEPENDENTLY FROM SOURCE
 * (`AgentController::store`, `create_agent_table` migration), per the M3.6
 * discovery pass — not inherited from Managers'/Commercials' edit forms by
 * resemblance, which use the much narrower `update()` surface.
 *
 * Every field below, its required-ness, and its MIME/size rule are asserted
 * exactly as the validator declares them:
 *   - `role` selects manager vs commercial. NEITHER role adds required-ness
 *     to the other's fields — `ville_sous_responsabilite` (manager) and
 *     `manager_id`/`ville_actuelle`/`secteur` (commercial) are ALL
 *     `nullable` in the validator. The backend force-nulls the wrong role's
 *     fields silently on create, so this is a VISIBILITY question, not an
 *     additional validation rule.
 *   - Every file field is capped at 2MB (`max:2048`), uniformly — verified by
 *     grepping every occurrence in `store()`. Design System §12's stated
 *     "5MB proofs" tier does not exist anywhere in the real backend; do not
 *     represent one in this UI.
 *   - `photo`/`photo_cin_recto`/`photo_cin_verso` accept images only
 *     (`mimes:jpeg,png,jpg`) — no PDF. Every other document (certificat,
 *     carte auto-entrepreneur, both fiches, all four moto documents) accepts
 *     `mimes:pdf,jpeg,png,jpg`.
 *   - `salaire`, `montant_declaration_cnss` and `charge_auto_entrepreneur`
 *     are validated as `integer` — whole numbers only — even though their
 *     DB columns are `decimal(10,2)`. `montant_essence` is `numeric`,
 *     genuinely decimal, and carries its own cross-field rule below. Modelled
 *     as three separate plain-integer string fields plus one money-style
 *     string field, not four money fields, to honor this real distinction.
 *   - The moto/essence business rule is NOT part of the validator array — the
 *     backend checks it manually and returns its own field-mapped 422:
 *     `montant_essence` MUST be exactly 0 whenever the agent has no
 *     motorcycle, OR the motorcycle is electric. Mirrored here in
 *     `superRefine` exactly as the backend computes it.
 *
 * ADR-0016's lesson applied directly: Design System §12's "MUST use an
 * entity-chip picker for any foreign key in a form" would apply to
 * `manager_id` here. Per this milestone's approved scope, this is
 * deliberately narrowed to the existing bounded `<select>` pattern already
 * used everywhere else in Network (`useManagerOptionsQuery`, unchanged) —
 * not the product's first async entity-chip picker. Recorded here as the
 * intentional narrowing, not a gap discovered later.
 */

export const AGENT_ROLES = ["manager", "commercial"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  manager: "Manager",
  commercial: "Commercial",
};

export const MOTO_TYPES = ["essance", "electrique"] as const;
export type MotoType = (typeof MOTO_TYPES)[number];
export const MOTO_TYPE_LABELS: Record<MotoType, string> = {
  essance: "Gas",
  electrique: "Electric",
};

/** `num_cin`/`num_de_chassis` share this exact regex in both `store()` and `update()`. */
const ALNUM_DASH_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * The SAME Moroccan phone pattern `ClientFormSheet` already validates
 * `phone` against, verified there from `ClientController::update`'s own
 * regex — duplicated here rather than imported (ADR-0012: validation
 * schemas stay duplicated per domain), not re-derived. `num_d_abonnement`
 * ("Phone Subscription Number") is NOT itself validated as a phone number
 * server-side (`AgentController::store`: `required|string|max:255`, plain) —
 * this is a deliberate, FRONTEND-ONLY tightening matching the field's own
 * relabelling, not a backend contract change. The payload sent is still the
 * exact string the operator typed, unchanged.
 */
const MOROCCAN_PHONE_REGEX = /^(\+212|0)[5-7][0-9]{8}$/;

/** Every file field is capped at 2MB (`max:2048`) — uniformly, verified from source. */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/** `photo`, `photo_cin_recto`, `photo_cin_verso` — `mimes:jpeg,png,jpg`, no PDF. */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

/** Every other document — `mimes:pdf,jpeg,png,jpg`. */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const DOCUMENT_ACCEPT =
  ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

export const WIZARD_STEPS = [
  "identity",
  "documents",
  "financial",
  "moto",
  "review",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

const fileValue = () =>
  z.custom<File | null>((value) => value === null || value instanceof File);

/** Every field starts permissive; `superRefine` below carries every real rule, mirroring how the backend itself splits declarative validation from its one manual business-rule check. */
const shape = {
  role: z.enum(AGENT_ROLES),

  nom: z.string().trim().min(1, "Last name is required.").max(255),
  prenom: z.string().trim().min(1, "First name is required.").max(255),
  ville: z.string().trim().min(1, "City is required.").max(255),
  adresse: z.string().trim().min(1, "Address is required.").max(255),
  numCin: z
    .string()
    .trim()
    .min(1, "CIN number is required.")
    .max(255)
    .regex(ALNUM_DASH_REGEX, "Letters, numbers, - and _ only."),
  numIce: z.string().trim().min(1, "ICE number is required.").max(255),

  /** Manager-specific. Nullable server-side — never required. */
  villeSousResponsabilite: z.string().trim().max(255).optional(),
  /** Commercial-specific. Nullable server-side. Held as a string id (select value), matching `CommercialListParams.managerId`'s own convention. */
  managerId: z.string().optional(),
  villeActuelle: z.string().trim().max(255).optional(),
  secteur: z.string().trim().max(255).optional(),

  photo: fileValue(),
  photoCinRecto: fileValue(),
  photoCinVerso: fileValue(),
  certificatDHabitat: fileValue(),
  carteAutoEntrepreneur: fileValue(),
  ficheAntroprometrique: fileValue(),
  ficheDIncidentBanquaire: fileValue(),

  numDAbonnement: z
    .string()
    .trim()
    .min(1, "Subscription number is required.")
    .regex(
      MOROCCAN_PHONE_REGEX,
      "Enter a valid Moroccan phone number (e.g. 0612345678).",
    ),
  /** `integer` server-side — whole numbers only, despite the decimal column. */
  salaire: z
    .string()
    .trim()
    .min(1, "Salary is required.")
    .regex(/^\d+$/, "Whole numbers only, no decimals."),
  /** `numeric` server-side — genuinely decimal, and carries the moto/electric cross-field rule below. */
  montantEssence: z.string().trim().min(1, "Fuel amount is required."),
  montantDeclarationCnss: z
    .string()
    .trim()
    .min(1, "CNSS declared amount is required.")
    .regex(/^\d+$/, "Whole numbers only, no decimals."),
  chargeAutoEntrepreneur: z
    .string()
    .trim()
    .min(1, "Auto-entrepreneur charge is required.")
    .regex(/^\d+$/, "Whole numbers only, no decimals."),

  hasMoto: z.boolean(),
  // A plain nullable, optional string — not `z.enum(MOTO_TYPES).optional()`.
  // An unselected native radio GROUP is reported by react-hook-form as
  // `null` (its own "no radio checked" sentinel, verified empirically, not
  // `undefined`), and an enum's own base-shape check would reject that
  // before `superRefine` ever runs its own "required" message. `superRefine`
  // below is the sole source of both "required" and "valid option"
  // validation for this field, exactly as it already is for every file field.
  typeMoto: z.string().nullable().optional(),
  numDeChassis: z.string().trim().max(255).optional(),
  cartGriseRecto: fileValue(),
  cartGriseVerso: fileValue(),
  assurance: fileValue(),
  engagementMoto: fileValue(),
};

function checkFileConstraints(
  ctx: z.RefinementCtx,
  file: File,
  path: string,
  mimeTypes: readonly string[],
) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    ctx.addIssue({
      code: "custom",
      message: "File must be 2MB or smaller.",
      path: [path],
    });
  }
  if (!mimeTypes.includes(file.type)) {
    ctx.addIssue({ code: "custom", message: "Unsupported file type.", path: [path] });
  }
}

function checkRequiredFile(
  ctx: z.RefinementCtx,
  file: File | null | undefined,
  path: string,
  mimeTypes: readonly string[],
) {
  if (!file) {
    ctx.addIssue({ code: "custom", message: "This file is required.", path: [path] });
    return;
  }
  checkFileConstraints(ctx, file, path, mimeTypes);
}

function checkOptionalFile(
  ctx: z.RefinementCtx,
  file: File | null | undefined,
  path: string,
  mimeTypes: readonly string[],
) {
  if (!file) return;
  checkFileConstraints(ctx, file, path, mimeTypes);
}

export const agentOnboardingSchema = z.object(shape).superRefine((data, ctx) => {
  checkRequiredFile(ctx, data.photo, "photo", IMAGE_MIME_TYPES);
  checkRequiredFile(ctx, data.photoCinRecto, "photoCinRecto", IMAGE_MIME_TYPES);
  checkRequiredFile(ctx, data.photoCinVerso, "photoCinVerso", IMAGE_MIME_TYPES);
  checkRequiredFile(
    ctx,
    data.certificatDHabitat,
    "certificatDHabitat",
    DOCUMENT_MIME_TYPES,
  );
  checkRequiredFile(
    ctx,
    data.carteAutoEntrepreneur,
    "carteAutoEntrepreneur",
    DOCUMENT_MIME_TYPES,
  );
  checkOptionalFile(
    ctx,
    data.ficheAntroprometrique,
    "ficheAntroprometrique",
    DOCUMENT_MIME_TYPES,
  );
  checkOptionalFile(
    ctx,
    data.ficheDIncidentBanquaire,
    "ficheDIncidentBanquaire",
    DOCUMENT_MIME_TYPES,
  );

  // `parseMoney` accepts both "150,50" and "150.50" — paste-tolerant, same as
  // every money field in the product (shared/formatters/money.ts).
  const essence = parseMoney(data.montantEssence);
  if (essence === null || essence < 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid amount.",
      path: ["montantEssence"],
    });
  }

  if (data.hasMoto) {
    if (!data.typeMoto) {
      ctx.addIssue({
        code: "custom",
        message: "Motorcycle type is required.",
        path: ["typeMoto"],
      });
    }
    if (!data.numDeChassis?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Chassis number is required.",
        path: ["numDeChassis"],
      });
    } else if (!ALNUM_DASH_REGEX.test(data.numDeChassis)) {
      ctx.addIssue({
        code: "custom",
        message: "Letters, numbers, - and _ only.",
        path: ["numDeChassis"],
      });
    }
    checkRequiredFile(ctx, data.cartGriseRecto, "cartGriseRecto", DOCUMENT_MIME_TYPES);
    checkRequiredFile(ctx, data.cartGriseVerso, "cartGriseVerso", DOCUMENT_MIME_TYPES);
    checkRequiredFile(ctx, data.assurance, "assurance", DOCUMENT_MIME_TYPES);
    checkRequiredFile(ctx, data.engagementMoto, "engagementMoto", DOCUMENT_MIME_TYPES);

    // Mirrors AgentController::store exactly: essence must be 0 for an
    // electric moto, but MAY be nonzero for a gas one.
    if (data.typeMoto === "electrique" && essence !== null && essence !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "Fuel amount must be 0 for an electric motorcycle.",
        path: ["montantEssence"],
      });
    }
  } else {
    checkOptionalFile(ctx, data.cartGriseRecto, "cartGriseRecto", DOCUMENT_MIME_TYPES);
    checkOptionalFile(ctx, data.cartGriseVerso, "cartGriseVerso", DOCUMENT_MIME_TYPES);
    checkOptionalFile(ctx, data.assurance, "assurance", DOCUMENT_MIME_TYPES);
    checkOptionalFile(ctx, data.engagementMoto, "engagementMoto", DOCUMENT_MIME_TYPES);

    // Mirrors AgentController::store exactly: no moto at all also forces 0.
    if (essence !== null && essence !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "Fuel amount must be 0 when the agent has no motorcycle.",
        path: ["montantEssence"],
      });
    }
  }
});

export type AgentOnboardingFormValues = z.infer<typeof agentOnboardingSchema>;

/**
 * Per-step field lists, for `form.trigger([...])` on "Next" — validates only
 * the CURRENT step's fields, per FTA D-9 ("per-step schema"). Static, not
 * conditioned on role/hasMoto: the schema's own `superRefine` only raises
 * issues for whichever role/moto state is actually selected, so triggering
 * the full per-step list is always safe — an untouched, not-yet-relevant
 * field never blocks a step it doesn't belong to.
 *
 * `montantEssence` IS IN THE `moto` LIST, NOT `financial` — and, since M3.6's
 * manual-validation review, its INPUT lives on the Moto step too, not just
 * its validation trigger. The field is only ever meaningful for a GAS
 * motorcycle (`hasMoto && typeMoto === "essance"`); every other combination
 * forces it to exactly "0" server-side, mirrored by `MotoStep`'s own effect
 * that resets the value the instant that condition stops holding. The
 * cross-field rule is enforced leaving Moto, and again at Review's full
 * submission.
 */
export const STEP_FIELDS: Record<
  Exclude<WizardStep, "review">,
  (keyof AgentOnboardingFormValues)[]
> = {
  identity: [
    "role",
    "nom",
    "prenom",
    "ville",
    "adresse",
    "numCin",
    "numIce",
    "villeSousResponsabilite",
    "managerId",
    "villeActuelle",
    "secteur",
  ],
  documents: [
    "photo",
    "photoCinRecto",
    "photoCinVerso",
    "certificatDHabitat",
    "carteAutoEntrepreneur",
    "ficheAntroprometrique",
    "ficheDIncidentBanquaire",
  ],
  financial: [
    "numDAbonnement",
    "salaire",
    "montantDeclarationCnss",
    "chargeAutoEntrepreneur",
  ],
  moto: [
    "hasMoto",
    "typeMoto",
    "numDeChassis",
    "cartGriseRecto",
    "cartGriseVerso",
    "assurance",
    "engagementMoto",
    "montantEssence",
  ],
};

export function defaultAgentOnboardingValues(role: AgentRole): AgentOnboardingFormValues {
  return {
    role,
    nom: "",
    prenom: "",
    ville: "",
    adresse: "",
    numCin: "",
    numIce: "",
    villeSousResponsabilite: "",
    managerId: "",
    villeActuelle: "",
    secteur: "",
    photo: null,
    photoCinRecto: null,
    photoCinVerso: null,
    certificatDHabitat: null,
    carteAutoEntrepreneur: null,
    ficheAntroprometrique: null,
    ficheDIncidentBanquaire: null,
    numDAbonnement: "",
    salaire: "",
    // Defaults to "0", not "": the field starts hidden (no motorcycle by
    // default), and "0" is the exact value the backend requires for every
    // combination other than a gas motorcycle — see MotoStep.
    montantEssence: "0",
    montantDeclarationCnss: "",
    chargeAutoEntrepreneur: "",
    hasMoto: false,
    typeMoto: undefined,
    numDeChassis: "",
    cartGriseRecto: null,
    cartGriseVerso: null,
    assurance: null,
    engagementMoto: null,
  };
}
