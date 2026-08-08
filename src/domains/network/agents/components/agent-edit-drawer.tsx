import { useEffect } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatMoneyValue, parseMoney } from "@/shared/formatters";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useManagerOptionsQuery } from "@/domains/network/managers";
import {
  useCommercialStockQuantityQuery,
  useUpdateAgentMutation,
} from "../queries/agents-queries";
import type { Agent, CommercialAgent } from "../model/agent";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

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
 * approved; widened for the M7 Agent 360 completion item) — not merely
 * everything `GET /admin/agents/{id}` happens to return. Deliberately
 * EXCLUDED, each for its own reason:
 *   - `status` — owned by Block/Activate, their own endpoints/permissions.
 *   - Every Moto field — a distinct conditional sub-entity, its own future
 *     scope (D1).
 *   - `num_de_compte`/`date_ajouter`/`mdp` — technically accepted by the
 *     same endpoint via its legacy `$keyMapping`, but backend-generated,
 *     creation-time-set, or a raw password-set alias with no relation to
 *     any real password-change feature. None gets a field, ever.
 *
 * `manager_id` (COMMERCIAL ONLY) — REASSIGNMENT WITH THE ZERO-STOCK GUARD
 * (M7 Agent 360 completion item, supersedes Phase 1.5's own D2 exclusion).
 * The frozen architecture names this exact workflow as the Agent edit
 * form's own responsibility; D2 excluded it on a since-resolved blocker (no
 * authoritative Commercial stock read existed). Backend commit `5302f99`
 * closed that gap: `GET /admin/agents/{agent}/stock-quantity` (see
 * `ManagerReassignmentField` below) plus a hardened, atomic `update()`
 * guard. `useManagerOptionsQuery({ status: "active" })` — Managers' own
 * public picker surface, the SAME hook `create-allocation-page.tsx`
 * already uses for an identical "backend has no eligibility check of its
 * own beyond bare existence" reason (BC-H's `per_page=100` bound applies
 * here too, documented not specially warned about, matching every other
 * picker in this codebase). The proactive stock read is a UX hint only —
 * `update()`'s own atomic, locked guard remains the sole authority; see
 * `useUpdateAgentMutation`'s own `onError` for the race-recovery path.
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
 * FIELD-LEVEL 422 MAPPING IS NOW GENUINELY REACHABLE — the BC-N-class
 * defect this docblock previously disclosed (`update()`'s own
 * `$request->validate([...])` swallowed by a broad `catch (\Exception $e)`,
 * turning a validation failure into a generic 500) was fixed in the same
 * backend commit (`5302f99`) that added the reassignment guard: `update()`
 * now catches `ValidationException` before the generic handler, mirroring
 * `store()`. A genuine Laravel `{message, errors:{...}}` 422 — e.g. an
 * eligibility-rejected `manager_id` — now maps onto its own field below,
 * not just the generic banner.
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
    /**
     * Commercial-only. A native `<select>`-bound string id (mirrors
     * `create-allocation.ts`'s own `companyId`/`agentId` fields exactly),
     * converted to a number only at submit time. Required-ness is
     * role-conditional — see `superRefine` below — because it is simply
     * unused, never rendered, for a manager.
     */
    managerId: z.string().trim(),

    photo: z.instanceof(File).nullable(),
    photoCinRecto: z.instanceof(File).nullable(),
    photoCinVerso: z.instanceof(File).nullable(),
    certificatDHabitat: z.instanceof(File).nullable(),
    carteAutoEntrepreneur: z.instanceof(File).nullable(),
    ficheAntroprometrique: z.instanceof(File).nullable(),
    ficheDIncidentBanquaire: z.instanceof(File).nullable(),
  })
  .superRefine((values, ctx) => {
    // `villeSousResponsabilite`/`villeActuelle`/`secteur` need no rule here
    // — all three are genuinely optional server-side, verified from
    // source. `managerId` is the one real cross-field requirement this
    // schema carries: required for a commercial (a reassignment target
    // must always be a real selection, matching how the select's own
    // options never include a "none" choice), unused for a manager.
    if (values.role === "commercial" && !values.managerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manager is required.",
        path: ["managerId"],
      });
    }
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
      managerId: "",
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
        managerId:
          agent.role === "commercial" && agent.manager ? String(agent.manager.id) : "",
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
                managerId: Number(values.managerId),
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

  // Field-level 422s map to their own fields — see the module docblock for
  // why this is now genuinely reachable, not just forward-compatible.
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
  const managerIdError = fieldError("manager_id");

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
    !!secteurError ||
    !!managerIdError;

  // The reassignment race (M7 Agent 360 completion item): the proactive
  // stock-quantity read said zero, but `update()`'s own atomic guard
  // re-checked under lock and found otherwise. Surfaced via the registry's
  // own copy (`resolveErrorDisplay`), not a hand-rolled string, so this and
  // any other future consumer of the same code can never drift apart.
  const reassignmentBlockedMessage =
    isAppError(error) && error.code === "COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN"
      ? resolveErrorDisplay(error).message
      : undefined;

  const generalError =
    reassignmentBlockedMessage ??
    (isAppError(error) && !hasFieldError && error.kind !== "validation"
      ? error.kind === "permission"
        ? "This account cannot be modified."
        : "Something went wrong. Please try again."
      : undefined);

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

          {agent && agent.role === "commercial" ? (
            <ManagerReassignmentField
              agent={agent}
              control={form.control}
              invalid={!!form.formState.errors.managerId || !!managerIdError}
              error={form.formState.errors.managerId?.message ?? managerIdError}
            />
          ) : null}
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

/**
 * The Zero-stock reassignment guard's UI (M7 Agent 360 completion item) —
 * a separate component, conditionally MOUNTED only when `agent.role ===
 * "commercial"` (the same zero-footprint pattern `AgentStockPanel`'s own
 * role-branched sub-components already established in Phase 2): both
 * hooks below are always called unconditionally here, but this component
 * itself is never rendered for a manager, so neither ever fires for one —
 * satisfying "Manager Agent Edit must not request the Commercial
 * stock-quantity endpoint" without adding an `enabled` branch to a shared
 * hook signature.
 *
 * `access-dashboard` GATES THE STOCK READ, RE-VERIFIED FROM SOURCE — the
 * endpoint's own permission (`routes/api.php`), independent of `update-
 * agent` (which merely reaches this drawer at all). Without it, the field
 * FAILS CLOSED: disabled, with an explanation that stock could not be
 * verified — never silently allowed just because the read could not run.
 *
 * FAIL-CLOSED ALSO APPLIES TO LOADING/ERROR — `hasStock` defaults to `true`
 * (blocking) whenever the authoritative quantity is not yet a confirmed
 * `0`, exactly the same "a missing/loading read never enables an
 * irreversible action" discipline `AgentTransferDetailPage`'s own restock-
 * gate integration already established, inverted (there, a missing read
 * never BLOCKS; here, a missing read never UNBLOCKS — the asymmetry is
 * correct, because here safety means refusing reassignment, not refusing
 * to warn).
 *
 * NO STOCK QUANTITY IS EVER DERIVED FROM TRANSFERS/RETURNS/MOVEMENT
 * HISTORY — the ONLY figure rendered is `stock_quantity` from the
 * authoritative endpoint, verbatim. No client-side sum, no activity-based
 * inference.
 */
function ManagerReassignmentField({
  agent,
  control,
  invalid,
  error,
}: {
  agent: CommercialAgent;
  control: Control<FormValues>;
  invalid: boolean;
  error?: string;
}) {
  const { has } = usePermission();
  const canReadStock = has(PERMISSIONS.ACCESS_DASHBOARD);
  const stockQuery = useCommercialStockQuantityQuery(agent.id, {
    enabled: canReadStock,
  });
  const managersQuery = useManagerOptionsQuery({ status: "active" });

  const stockConfirmedZero = canReadStock && stockQuery.data === 0;
  const stockConfirmedPositive = canReadStock && (stockQuery.data ?? 0) > 0;
  // Fail closed: enabled only once the authoritative read has confirmed
  // zero. Loading, error, and unauthorized all leave it disabled.
  const fieldDisabled = !stockConfirmedZero;

  const currentManagerLabel = agent.manager
    ? `${agent.manager.prenom} ${agent.manager.nom}`
    : "None";

  const stockStatusText = !canReadStock
    ? "Current stock could not be verified."
    : stockQuery.isPending
      ? "Checking current stock…"
      : stockQuery.isError
        ? "Current stock could not be verified."
        : `Current stock: ${stockQuery.data}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="agentManagerId" className="text-sm font-medium">
        Manager
      </label>
      <p className="text-muted-foreground text-xs">
        Current manager: {currentManagerLabel}
      </p>
      {/*
       * `Controller`, NOT `register` — the seeded value (the commercial's
       * CURRENT manager id) must survive `useManagerOptionsQuery` resolving
       * AFTER this field first mounts. `register`'s uncontrolled ref sets
       * the DOM `<select>.value` once, at mount; assigning a value with no
       * matching `<option>` yet is a silent no-op that does NOT retroactively
       * apply once a matching option is added later (verified browser/jsdom
       * behavior) — the seeded manager would render as unselected. A
       * controlled select (`value={field.value}`) re-applies on every
       * render, so the correct option is selected the moment it exists.
       */}
      <Controller
        control={control}
        name="managerId"
        render={({ field }) => (
          <select
            id="agentManagerId"
            className={SELECT_CLASS}
            disabled={fieldDisabled}
            aria-invalid={invalid}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
          >
            <option value="">Select a manager</option>
            {(managersQuery.data ?? []).map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.prenom} {manager.nom}
              </option>
            ))}
          </select>
        )}
      />
      <p className="text-muted-foreground text-xs">{stockStatusText}</p>
      {stockConfirmedPositive ? (
        <p className="text-destructive text-xs">
          This commercial must return or clear their current stock before changing
          Manager.
        </p>
      ) : null}
      {canReadStock && stockQuery.isError ? (
        <button
          type="button"
          className="text-primary w-fit text-xs underline underline-offset-4"
          onClick={() => void stockQuery.refetch()}
        >
          Retry
        </button>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
