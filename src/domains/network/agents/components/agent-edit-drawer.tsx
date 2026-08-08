import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { formatMoneyValue, parseMoney } from "@/shared/formatters";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useUpdateAgentMutation } from "../queries/agents-queries";
import type { Agent } from "../model/agent";

/**
 * Full role-aware Agent edit (M7 Phase 1.5). Opened from `AgentWorkspacePage`'s
 * own action row — the exact slot Phase 1 reserved for this.
 *
 * ONE FLAT ZOD SCHEMA, NOT `z.discriminatedUnion` — mirrors
 * `agent-onboarding.ts`'s own proven shape (every field declared once,
 * role-specific fields `.optional()`, `superRefine` below carries the real
 * per-role requirement) rather than a true discriminated union, which would
 * force every `register`/`Controller` callsite to re-narrow a union type for
 * no validation benefit react-hook-form doesn't already give this shape.
 * Validation still genuinely branches by role — "discriminated" describes
 * the BEHAVIOR (superRefine), not the TypeScript type shape.
 *
 * THE FIELD SET IS THE FULL BACKEND-SUPPORTED EDITABLE SET, VERIFIED FIELD
 * BY FIELD AGAINST `AgentController::update()` (M7 Phase 1.5 discovery,
 * approved) — not merely everything `GET /admin/agents/{id}` happens to
 * return. Deliberately EXCLUDED, each for its own reason already recorded
 * in that discovery pass:
 *   - `status` — owned by Block/Activate, their own endpoints/permissions.
 *   - `manager_id` — a stock-sensitive reassignment business operation
 *     (`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`), not a profile field (D2).
 *   - Every Moto field — a distinct conditional sub-entity, its own future
 *     scope (D1).
 *   - `num_de_compte`/`date_ajouter`/`mdp` — technically accepted by the
 *     same endpoint via its legacy `$keyMapping`, but backend-generated,
 *     creation-time-set, or a raw password-set alias with no relation to
 *     any real password-change feature. None gets a field, ever.
 *
 * `numIce` IS CLIENT-SIDE REQUIRED despite being nullable server-side — NOT
 * a stricter rule invented here, but an honest reflection of a REAL,
 * DISCLOSED backend limitation: `update()`'s own validator combines
 * `sometimes` with `required`, so an empty-string clear attempt is rejected.
 * There is no way to clear this field through this endpoint; requiring it
 * client-side prevents submitting a request guaranteed to fail, the same
 * reasoning `numAbonnement` is already client-side-required on
 * `ManagerFormSheet`/`CommercialFormSheet` despite its own server-side
 * nullability.
 *
 * `salaire`/`montantDeclarationCnss`/`chargeAutoEntrepreneur` ARE PLAIN
 * WHOLE-NUMBER STRINGS (`integer`-validated server-side, verified from
 * source) — NOT money inputs. Seeded from the wire's `decimal:2`-cast
 * string (e.g. `"3000.00"`) by taking the integer part only; submitted
 * as-is. `montantEssence` is the one exception (`numeric`-validated,
 * genuinely decimal) and is treated as a real Money input — seeded via
 * `formatMoneyValue`, submitted via `parseMoney` — mirroring
 * `agent-onboarding.ts`'s own identical field exactly.
 *
 * FILES FOLLOW `FileUploadField`'s OWN NEW `existingUrl` CONTRACT (M7
 * Phase 1.5, `shared/`): each of the seven document fields renders the
 * agent's current file via `existingUrl` and starts with a `null` local
 * `File` value on every open — selecting nothing means "no replacement",
 * and `updateAgent`'s own `buildUpdateFormData` omits that field entirely
 * rather than resending anything, preserving the backend's existing file
 * exactly as `AgentController::update()`'s own `if ($request->hasFile(...))`
 * guard already does. No field offers bare removal — the backend has no
 * such capability.
 *
 * FIELD-LEVEL 422 MAPPING IS BUILT BUT CURRENTLY UNREACHABLE — a real,
 * disclosed backend defect (BC-N class): `update()`'s own
 * `$request->validate([...])` sits inside its own broad
 * `catch (\Exception $e)`, so a validation failure returns a generic 500,
 * never Laravel's `{errors:{...}}` shape. The mapping below is
 * forward-compatible (matches `ManagerFormSheet`'s/`CommercialFormSheet`'s
 * own identical, currently-dead field-mapping code) and the generic banner
 * is the path that actually fires today.
 */

const ALNUM_DASH_REGEX = /^[A-Za-z0-9_-]+$/;
const WHOLE_NUMBER_REGEX = /^\d+$/;

const editSchema = z
  .object({
    role: z.enum(["manager", "commercial"]),

    nom: z
      .string()
      .trim()
      .min(1, "Last name is required.")
      .max(255, "Last name is too long."),
    prenom: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(255, "First name is too long."),
    ville: z.string().trim().min(1, "City is required.").max(255, "City is too long."),
    adresse: z
      .string()
      .trim()
      .min(1, "Address is required.")
      .max(255, "Address is too long."),
    numCin: z
      .string()
      .trim()
      .min(1, "CIN is required.")
      .max(255, "CIN is too long.")
      .regex(ALNUM_DASH_REGEX, "Letters, numbers, - and _ only."),
    // No format regex — `update()`'s own validator has none for num_ice,
    // only `store()` implicitly does via a different field's shape. Only
    // non-empty is enforced, per the module docblock.
    numIce: z.string().trim().min(1, "ICE is required.").max(255, "ICE is too long."),
    numAbonnement: z
      .string()
      .trim()
      .min(1, "Subscription number is required.")
      .max(255, "Subscription number is too long."),

    salaire: z
      .string()
      .trim()
      .min(1, "Salary is required.")
      .regex(WHOLE_NUMBER_REGEX, "Whole numbers only, no decimals."),
    montantEssence: z.string().trim().min(1, "Fuel amount is required."),
    montantDeclarationCnss: z
      .string()
      .trim()
      .min(1, "CNSS declared amount is required.")
      .regex(WHOLE_NUMBER_REGEX, "Whole numbers only, no decimals."),
    chargeAutoEntrepreneur: z
      .string()
      .trim()
      .min(1, "Auto-entrepreneur charge is required.")
      .regex(WHOLE_NUMBER_REGEX, "Whole numbers only, no decimals."),

    /** Manager-only. Nullable server-side — never required, unlike the fields above. */
    villeSousResponsabilite: z
      .string()
      .trim()
      .max(255, "This value is too long.")
      .optional(),
    /** Commercial-only. Nullable server-side. */
    villeActuelle: z.string().trim().max(255, "This value is too long.").optional(),
    /** Commercial-only. Nullable server-side. No reference options source exists (BC-V) — a free-text field, matching the backend's own unstructured column. */
    secteur: z.string().trim().max(255, "This value is too long.").optional(),

    photo: z.instanceof(File).nullable(),
    photoCinRecto: z.instanceof(File).nullable(),
    photoCinVerso: z.instanceof(File).nullable(),
    certificatDHabitat: z.instanceof(File).nullable(),
    carteAutoEntrepreneur: z.instanceof(File).nullable(),
    ficheAntroprometrique: z.instanceof(File).nullable(),
    ficheDIncidentBanquaire: z.instanceof(File).nullable(),
  })
  .superRefine((values, ctx) => {
    // No cross-field rule needed today — neither role adds required-ness to
    // the other's own field (both `villeSousResponsabilite` and
    // `villeActuelle`/`secteur` are genuinely optional server-side,
    // verified from source). Kept as an explicit, empty extension point:
    // `agent-onboarding.ts`'s own `superRefine` is where its one real
    // cross-field rule (the moto/essence business check) lives, and this
    // is the same seam should Agent Edit ever need one — not a placeholder
    // suggesting one is missing today.
    void values;
    void ctx;
  });

type FormValues = z.infer<typeof editSchema>;

/** `"3000.00"` -> `"3000"` — never rounds, just drops the fractional part the `decimal:2` cast always adds for an `integer`-validated field. */
function toWholeNumberString(decimalString: string): string {
  return decimalString.split(".")[0] ?? "0";
}

type AgentEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The agent being edited. Absent = the drawer is closed. */
  agent?: Agent;
};

export function AgentEditDrawer({ open, onOpenChange, agent }: AgentEditDrawerProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      role: "manager",
      nom: "",
      prenom: "",
      ville: "",
      adresse: "",
      numCin: "",
      numIce: "",
      numAbonnement: "",
      salaire: "",
      montantEssence: "",
      montantDeclarationCnss: "",
      chargeAutoEntrepreneur: "",
      villeSousResponsabilite: "",
      villeActuelle: "",
      secteur: "",
      photo: null,
      photoCinRecto: null,
      photoCinVerso: null,
      certificatDHabitat: null,
      carteAutoEntrepreneur: null,
      ficheAntroprometrique: null,
      ficheDIncidentBanquaire: null,
    },
  });

  const updateMutation = useUpdateAgentMutation();

  // Re-seed on open, or editing one agent straight after another shows the
  // previous one's values. Files always reset to `null` — see the module
  // docblock: a local `File` is never seeded, only ever selected fresh.
  useEffect(() => {
    if (open && agent) {
      form.reset({
        role: agent.role,
        nom: agent.nom,
        prenom: agent.prenom,
        ville: agent.ville ?? "",
        adresse: agent.adresse ?? "",
        numCin: agent.numCin,
        numIce: agent.numIce ?? "",
        numAbonnement: agent.numAbonnement ?? "",
        salaire: toWholeNumberString(agent.salaire),
        montantEssence: formatMoneyValue(Number(agent.montantEssence)),
        montantDeclarationCnss: toWholeNumberString(agent.montantDeclarationCnss),
        chargeAutoEntrepreneur: toWholeNumberString(agent.chargeAutoEntrepreneur),
        villeSousResponsabilite:
          agent.role === "manager" ? (agent.villeSousResponsabilite ?? "") : "",
        villeActuelle: agent.role === "commercial" ? (agent.villeActuelle ?? "") : "",
        secteur: agent.role === "commercial" ? (agent.secteur ?? "") : "",
        photo: null,
        photoCinRecto: null,
        photoCinVerso: null,
        certificatDHabitat: null,
        carteAutoEntrepreneur: null,
        ficheAntroprometrique: null,
        ficheDIncidentBanquaire: null,
      });
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent?.id]);

  const onSubmit = form.handleSubmit((values) => {
    if (!agent) return;

    const common = {
      nom: values.nom,
      prenom: values.prenom,
      ville: values.ville,
      adresse: values.adresse,
      numCin: values.numCin,
      numIce: values.numIce,
      numAbonnement: values.numAbonnement,
      salaire: values.salaire,
      montantEssence: String(parseMoney(values.montantEssence) ?? 0),
      montantDeclarationCnss: values.montantDeclarationCnss,
      chargeAutoEntrepreneur: values.chargeAutoEntrepreneur,
    };

    updateMutation.mutate(
      {
        id: agent.id,
        input:
          values.role === "manager"
            ? {
                ...common,
                role: "manager",
                villeSousResponsabilite: values.villeSousResponsabilite ?? "",
              }
            : {
                ...common,
                role: "commercial",
                villeActuelle: values.villeActuelle ?? "",
                secteur: values.secteur ?? "",
              },
        files: {
          photo: values.photo,
          photoCinRecto: values.photoCinRecto,
          photoCinVerso: values.photoCinVerso,
          certificatDHabitat: values.certificatDHabitat,
          carteAutoEntrepreneur: values.carteAutoEntrepreneur,
          ficheAntroprometrique: values.ficheAntroprometrique,
          ficheDIncidentBanquaire: values.ficheDIncidentBanquaire,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to their own fields — forward-compatible, see the
  // module docblock for why this is currently unreachable in production.
  const error = updateMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const nomError = fieldError("nom");
  const prenomError = fieldError("prenom");
  const villeError = fieldError("ville");
  const adresseError = fieldError("adresse");
  const numCinError = fieldError("num_cin");
  const numIceError = fieldError("num_ice");
  const numAbonnementError = fieldError("num_d_abonnement");
  const salaireError = fieldError("salaire");
  const montantEssenceError = fieldError("montant_essence");
  const montantDeclarationCnssError = fieldError("montant_declaration_cnss");
  const chargeAutoEntrepreneurError = fieldError("charge_auto_entrepreneur");
  const villeSousResponsabiliteError = fieldError("ville_sous_responsabilite");
  const villeActuelleError = fieldError("ville_actuelle");
  const secteurError = fieldError("secteur");

  const hasFieldError =
    !!nomError ||
    !!prenomError ||
    !!villeError ||
    !!adresseError ||
    !!numCinError ||
    !!numIceError ||
    !!numAbonnementError ||
    !!salaireError ||
    !!montantEssenceError ||
    !!montantDeclarationCnssError ||
    !!chargeAutoEntrepreneurError ||
    !!villeSousResponsabiliteError ||
    !!villeActuelleError ||
    !!secteurError;

  const generalError =
    isAppError(error) && !hasFieldError && error.kind !== "validation"
      ? error.kind === "permission"
        ? "This account cannot be modified."
        : "Something went wrong. Please try again."
      : undefined;

  const role = form.watch("role");

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit agent"
      description="Update this agent's profile."
      onSubmit={onSubmit}
      isPending={updateMutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentPrenom" className="text-sm font-medium">
          First name
        </label>
        <Input
          id="agentPrenom"
          autoFocus
          aria-invalid={!!form.formState.errors.prenom || !!prenomError}
          {...form.register("prenom")}
        />
        {form.formState.errors.prenom ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.prenom.message}
          </p>
        ) : null}
        {prenomError ? <p className="text-destructive text-xs">{prenomError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentNom" className="text-sm font-medium">
          Last name
        </label>
        <Input
          id="agentNom"
          aria-invalid={!!form.formState.errors.nom || !!nomError}
          {...form.register("nom")}
        />
        {form.formState.errors.nom ? (
          <p className="text-destructive text-xs">{form.formState.errors.nom.message}</p>
        ) : null}
        {nomError ? <p className="text-destructive text-xs">{nomError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentVille" className="text-sm font-medium">
          City
        </label>
        <Input
          id="agentVille"
          aria-invalid={!!form.formState.errors.ville || !!villeError}
          {...form.register("ville")}
        />
        {form.formState.errors.ville ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.ville.message}
          </p>
        ) : null}
        {villeError ? <p className="text-destructive text-xs">{villeError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentAdresse" className="text-sm font-medium">
          Address
        </label>
        <Input
          id="agentAdresse"
          aria-invalid={!!form.formState.errors.adresse || !!adresseError}
          {...form.register("adresse")}
        />
        {form.formState.errors.adresse ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.adresse.message}
          </p>
        ) : null}
        {adresseError ? <p className="text-destructive text-xs">{adresseError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentNumCin" className="text-sm font-medium">
          CIN
        </label>
        <Input
          id="agentNumCin"
          aria-invalid={!!form.formState.errors.numCin || !!numCinError}
          {...form.register("numCin")}
        />
        {form.formState.errors.numCin ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.numCin.message}
          </p>
        ) : null}
        {numCinError ? <p className="text-destructive text-xs">{numCinError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentNumIce" className="text-sm font-medium">
          ICE
        </label>
        <Input
          id="agentNumIce"
          aria-invalid={!!form.formState.errors.numIce || !!numIceError}
          {...form.register("numIce")}
        />
        {form.formState.errors.numIce ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.numIce.message}
          </p>
        ) : null}
        {numIceError ? <p className="text-destructive text-xs">{numIceError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentNumAbonnement" className="text-sm font-medium">
          Subscription number
        </label>
        <Input
          id="agentNumAbonnement"
          aria-invalid={!!form.formState.errors.numAbonnement || !!numAbonnementError}
          {...form.register("numAbonnement")}
        />
        {form.formState.errors.numAbonnement ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.numAbonnement.message}
          </p>
        ) : null}
        {numAbonnementError ? (
          <p className="text-destructive text-xs">{numAbonnementError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentSalaire" className="text-sm font-medium">
          Salary (MAD, whole numbers)
        </label>
        <Input
          id="agentSalaire"
          aria-invalid={!!form.formState.errors.salaire || !!salaireError}
          {...form.register("salaire")}
        />
        {form.formState.errors.salaire ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.salaire.message}
          </p>
        ) : null}
        {salaireError ? <p className="text-destructive text-xs">{salaireError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentMontantEssence" className="text-sm font-medium">
          Fuel amount (MAD)
        </label>
        <Input
          id="agentMontantEssence"
          aria-invalid={!!form.formState.errors.montantEssence || !!montantEssenceError}
          {...form.register("montantEssence")}
        />
        {form.formState.errors.montantEssence ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.montantEssence.message}
          </p>
        ) : null}
        {montantEssenceError ? (
          <p className="text-destructive text-xs">{montantEssenceError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentMontantDeclarationCnss" className="text-sm font-medium">
          CNSS declared amount (MAD, whole numbers)
        </label>
        <Input
          id="agentMontantDeclarationCnss"
          aria-invalid={
            !!form.formState.errors.montantDeclarationCnss ||
            !!montantDeclarationCnssError
          }
          {...form.register("montantDeclarationCnss")}
        />
        {form.formState.errors.montantDeclarationCnss ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.montantDeclarationCnss.message}
          </p>
        ) : null}
        {montantDeclarationCnssError ? (
          <p className="text-destructive text-xs">{montantDeclarationCnssError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="agentChargeAutoEntrepreneur" className="text-sm font-medium">
          Auto-entrepreneur charge (MAD, whole numbers)
        </label>
        <Input
          id="agentChargeAutoEntrepreneur"
          aria-invalid={
            !!form.formState.errors.chargeAutoEntrepreneur ||
            !!chargeAutoEntrepreneurError
          }
          {...form.register("chargeAutoEntrepreneur")}
        />
        {form.formState.errors.chargeAutoEntrepreneur ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.chargeAutoEntrepreneur.message}
          </p>
        ) : null}
        {chargeAutoEntrepreneurError ? (
          <p className="text-destructive text-xs">{chargeAutoEntrepreneurError}</p>
        ) : null}
      </div>

      {role === "manager" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agentVilleSousResponsabilite" className="text-sm font-medium">
            Area of responsibility
          </label>
          <Input
            id="agentVilleSousResponsabilite"
            aria-invalid={
              !!form.formState.errors.villeSousResponsabilite ||
              !!villeSousResponsabiliteError
            }
            {...form.register("villeSousResponsabilite")}
          />
          {form.formState.errors.villeSousResponsabilite ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.villeSousResponsabilite.message}
            </p>
          ) : null}
          {villeSousResponsabiliteError ? (
            <p className="text-destructive text-xs">{villeSousResponsabiliteError}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="agentVilleActuelle" className="text-sm font-medium">
              Current city
            </label>
            <Input
              id="agentVilleActuelle"
              aria-invalid={!!form.formState.errors.villeActuelle || !!villeActuelleError}
              {...form.register("villeActuelle")}
            />
            {form.formState.errors.villeActuelle ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.villeActuelle.message}
              </p>
            ) : null}
            {villeActuelleError ? (
              <p className="text-destructive text-xs">{villeActuelleError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="agentSecteur" className="text-sm font-medium">
              Sector
            </label>
            <Input
              id="agentSecteur"
              aria-invalid={!!form.formState.errors.secteur || !!secteurError}
              {...form.register("secteur")}
            />
            {form.formState.errors.secteur ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.secteur.message}
              </p>
            ) : null}
            {secteurError ? (
              <p className="text-destructive text-xs">{secteurError}</p>
            ) : null}
          </div>
        </>
      )}

      <Controller
        control={form.control}
        name="photo"
        render={({ field }) => (
          <FileUploadField
            label="Photo"
            required={false}
            accept="image/jpeg,image/png"
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.photoUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="photoCinRecto"
        render={({ field }) => (
          <FileUploadField
            label="CIN — front"
            required={false}
            accept="image/jpeg,image/png"
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.photoCinRectoUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="photoCinVerso"
        render={({ field }) => (
          <FileUploadField
            label="CIN — back"
            required={false}
            accept="image/jpeg,image/png"
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.photoCinVersoUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="certificatDHabitat"
        render={({ field }) => (
          <FileUploadField
            label="Habitat certificate"
            required={false}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.certificatHabitatUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="carteAutoEntrepreneur"
        render={({ field }) => (
          <FileUploadField
            label="Auto-entrepreneur card"
            required={false}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.carteAutoEntrepreneurUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="ficheAntroprometrique"
        render={({ field }) => (
          <FileUploadField
            label="Anthropometric form"
            required={false}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.ficheAntroprometriqueUrl}
          />
        )}
      />
      <Controller
        control={form.control}
        name="ficheDIncidentBanquaire"
        render={({ field }) => (
          <FileUploadField
            label="Bank incident form"
            required={false}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            existingUrl={agent?.ficheIncidentBancaireUrl}
          />
        )}
      />
    </FormDrawer>
  );
}
