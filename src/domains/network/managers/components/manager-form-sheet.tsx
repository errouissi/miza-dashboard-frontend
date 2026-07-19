import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { useVilleOptionsQuery } from "@/domains/reference/villes";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useUpdateManagerMutation } from "../queries/managers-queries";
import { ManagerAreaMultiSelect } from "./manager-area-multiselect";
import {
  parseVilleSousResponsabiliteAreas,
  serializeVilleSousResponsabiliteAreas,
  type Manager,
} from "../model/manager";

/**
 * Edit drawer for a manager.
 *
 * EDIT ONLY — THERE IS NO CREATE MODE, and that is a scope decision rather than an
 * omission. `AgentController::store` is the only agent-create endpoint and requires
 * roughly twenty fields plus FIVE mandatory file uploads (photo, both CIN faces,
 * certificat d'habitat, carte auto-entrepreneur), with `has_moto` conditionally
 * requiring four more files. That is the roadmap's CreateWizard — "the only wizard
 * in the product (FTA D-9), multi-file upload with named slots" — tracked as M3.6.
 * A drawer cannot honestly express it, so this component does not pretend to.
 *
 * THE FIELD SET IS BOUNDED BY WHAT THE LIST RETURNS. The update endpoint accepts
 * far more (adresse, num_cin, num_ice, salaire, the CNSS and auto-entrepreneur
 * charges), but the list row carries none of those, so the drawer could only render
 * them blank — and a blank input that saves is how a real value gets overwritten
 * with an empty one. Those fields belong to the deferred detail page (ADR-0014),
 * which will have `GET /admin/agents/{identifier}` to seed from.
 *
 * `status` is absent too: block and activate own it, on their own endpoints and
 * their own permissions.
 *
 * `ville` IS A SELECT, SOURCED FROM VILLES — not a free-text input. The
 * backend filters and stores it as an exact string (`where('ville', …)` on the
 * list, `agents.ville` a plain column, no foreign key), and the payload
 * contract is unchanged by this: it is still the city's NAME, not a numeric
 * Villes id, exactly as `ManagerVilleFilter` already sends for the list
 * filter. Gated the same way as that filter (`access-dashboard`, since that is
 * what guards `GET /admin/villes`) via `enabled` on the shared query, because
 * — unlike the filter, which the list page mounts conditionally — this
 * drawer's `children` render whenever the list page does (`FormDrawer` owns
 * only the shell), so the query would otherwise fire for every operator
 * regardless of permission.
 *
 * A CURRENT VALUE ABSENT FROM THE OPTIONS IS NEVER SILENTLY DROPPED (BC-S: a
 * manager's `ville` may have been typed differently from the reference list,
 * or set before some entries existed). It is rendered as an extra, clearly
 * labelled option so it stays selected and stays in the payload if the
 * operator does not touch the field — never replaced with the first option or
 * a blank by a `<select>` failing to match its seeded value.
 *
 * `villeSousResponsabilite` IS A VILLES-BACKED MULTI-SELECT (a manager may be
 * responsible for several cities), NOT free text and NOT a single select
 * either. THE BACKEND CONTRACT IS UNCHANGED: `ville_sous_responsabilite` is
 * still exactly one `nullable|string|max:255` column, filtered server-side by
 * partial match (`like %…%`) — verified from source, not guessed (see
 * `model/manager.ts`'s docblock on `parseVilleSousResponsabiliteAreas`). There
 * is no backend array, no delimiter convention of the backend's own, and no
 * migration here. The multiple-cities encoding is a FRONTEND-ONLY convention
 * (`", "`-joined names) applied to the same single string the backend has
 * always accepted; `ManagerFormSheet` still submits one string under the same
 * field name, exactly as `form.register` used to.
 *
 * The existing test fixture value "Grand Casablanca" — not a literal Villes
 * entry — is precisely the LEGACY-VALUE case this multi-select must handle
 * honestly: it stays checked and visible, labelled as absent from the
 * reference list, until the operator explicitly unchecks it. It is not
 * silently dropped by switching to a controlled widget.
 *
 * Copy is temporary English pending O-1.
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";
const editSchema = z.object({
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
  // Nullable server-side (`sometimes|nullable|string|max:255`), so an empty string
  // is a legitimate value meaning "no area of responsibility", not a validation error.
  villeSousResponsabilite: z.string().trim().max(255, "This value is too long."),
  numAbonnement: z
    .string()
    .trim()
    .min(1, "Subscription number is required.")
    .max(255, "Subscription number is too long."),
});

type FormValues = z.infer<typeof editSchema>;

type ManagerFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The manager being edited. Absent = the drawer is closed. */
  manager?: Manager;
};

export function ManagerFormSheet({ open, onOpenChange, manager }: ManagerFormSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      ville: "",
      villeSousResponsabilite: "",
      numAbonnement: "",
    },
  });

  const updateMutation = useUpdateManagerMutation();

  const { has } = usePermission();
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);
  const villesQuery = useVilleOptionsQuery({ enabled: canReadVilles });
  const villes = villesQuery.data ?? [];

  // The field currently registered, so a value the fetched options don't
  // contain can still be rendered rather than silently dropped by a <select>
  // that fails to match it to any <option>.
  const currentVille = form.watch("ville");
  const currentVilleIsKnown = villes.some((ville) => ville.nomVille === currentVille);
  // Only asserted "not in the list" once the list has actually resolved —
  // while it is loading or disabled (no access-dashboard), the value is
  // preserved without claiming to know whether it is legacy or not.
  const villeFallbackLabel =
    currentVille && !currentVilleIsKnown
      ? villesQuery.isSuccess
        ? `${currentVille} (not in the reference list)`
        : currentVille
      : undefined;

  // Re-seed on open, or editing one manager straight after another shows the
  // previous row's values.
  useEffect(() => {
    if (open && manager) {
      form.reset({
        nom: manager.nom,
        prenom: manager.prenom,
        // Both nullable server-side, despite neither name suggesting it (confirmed
        // against a live record with no ville and no subscription number). An
        // uncontrolled input's DOM value cannot legally be null, so a null here
        // becomes an empty string — never passed through raw.
        ville: manager.ville ?? "",
        // Normalised through the same parse/serialize pair the multi-select
        // itself uses (trim, dedupe, preserve order) THE MOMENT the form
        // opens — not only once the operator touches a checkbox. Duplicate
        // cities must never be submitted, including when the operator saves
        // without touching this field at all; a distinct legacy value (one
        // that simply isn't in the Villes options) is untouched by this,
        // since there is nothing to dedupe or trim away from it.
        villeSousResponsabilite: serializeVilleSousResponsabiliteAreas(
          parseVilleSousResponsabiliteAreas(manager.villeSousResponsabilite),
        ),
        numAbonnement: manager.numAbonnement ?? "",
      });
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, manager?.id]);

  const onSubmit = form.handleSubmit((values) => {
    if (!manager) return;
    updateMutation.mutate(
      { id: manager.id, ...values },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to their own fields. Note the wire names differ from the
  // form's: the backend reports against `num_d_abonnement`, not `numAbonnement`.
  const error = updateMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const nomError = fieldError("nom");
  const prenomError = fieldError("prenom");
  const villeError = fieldError("ville");
  const villeSousResponsabiliteError = fieldError("ville_sous_responsabilite");
  const numAbonnementError = fieldError("num_d_abonnement");

  const hasFieldError =
    !!nomError ||
    !!prenomError ||
    !!villeError ||
    !!villeSousResponsabiliteError ||
    !!numAbonnementError;

  const generalError =
    isAppError(error) && !hasFieldError && error.kind !== "validation"
      ? error.kind === "permission"
        ? "This account cannot be modified."
        : "Something went wrong. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit manager"
      description="Update this manager's details."
      onSubmit={onSubmit}
      isPending={updateMutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prenom" className="text-sm font-medium">
          First name
        </label>
        <Input
          id="prenom"
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
        <label htmlFor="nom" className="text-sm font-medium">
          Last name
        </label>
        <Input
          id="nom"
          aria-invalid={!!form.formState.errors.nom || !!nomError}
          {...form.register("nom")}
        />
        {form.formState.errors.nom ? (
          <p className="text-destructive text-xs">{form.formState.errors.nom.message}</p>
        ) : null}
        {nomError ? <p className="text-destructive text-xs">{nomError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="numAbonnement" className="text-sm font-medium">
          Subscription number
        </label>
        <Input
          id="numAbonnement"
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
        <label htmlFor="ville" className="text-sm font-medium">
          City
        </label>
        <select
          id="ville"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.ville || !!villeError}
          {...form.register("ville")}
        >
          <option value="">Select a city</option>
          {villeFallbackLabel ? (
            <option value={currentVille}>{villeFallbackLabel}</option>
          ) : null}
          {villes.map((ville) => (
            <option key={ville.id} value={ville.nomVille}>
              {ville.nomVille}
            </option>
          ))}
        </select>
        {form.formState.errors.ville ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.ville.message}
          </p>
        ) : null}
        {villeError ? <p className="text-destructive text-xs">{villeError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="villeSousResponsabilite" className="text-sm font-medium">
          Area of responsibility
        </label>
        <ManagerAreaMultiSelect
          id="villeSousResponsabilite"
          value={form.watch("villeSousResponsabilite")}
          onChange={(next) =>
            form.setValue("villeSousResponsabilite", next, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          villes={villes}
          villesResolved={villesQuery.isSuccess}
          aria-invalid={
            !!form.formState.errors.villeSousResponsabilite ||
            !!villeSousResponsabiliteError
          }
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
    </FormDrawer>
  );
}
