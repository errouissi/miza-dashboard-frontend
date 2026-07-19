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
import { useUpdateCommercialMutation } from "../queries/commercials-queries";
import type { Commercial } from "../model/commercial";

/**
 * Edit drawer for a commercial.
 *
 * EDIT ONLY — no create mode, identical reasoning to Managers: agent
 * onboarding is the M3.6 wizard.
 *
 * THE FIELD SET IS NARROWER THAN MANAGERS' — bounded by what `indexCommercials`
 * returns, which itself is narrower than `indexManagers`. Four fields, not
 * five: `secteur` is accepted by the update validator but never returned by
 * the list (would render blank and silently overwrite a real value on save),
 * and `manager_id` — though validator-nullable and a real FK — has no id
 * exposed anywhere in this row to seed a picker's selection with, and
 * reassignment carries a guarded business rule
 * (`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`) that belongs to the Agent Transfers
 * feature, not this form. Neither is a field here, and neither should become
 * one without a fetched detail record and a decision to build that feature.
 *
 * `status` is absent too: block and activate own it, on their own endpoints
 * and their own permissions.
 *
 * `villeActuelle` IS A SELECT, SOURCED FROM VILLES — not a free-text input,
 * for the identical reason as Managers' `ville`: `indexCommercials` filters it
 * with exact equality (`where('ville_actuelle', …)`), and the payload
 * contract is unchanged — the city's NAME, not a numeric Villes id, exactly
 * what `CommercialVilleFilter` already sends. Gated on `access-dashboard` via
 * `enabled` on the shared query for the same reason as Managers' form: this
 * drawer's `children` render whenever the list page does, unlike the filter
 * the list page mounts conditionally.
 *
 * A CURRENT VALUE ABSENT FROM THE OPTIONS is rendered as an extra, clearly
 * labelled option rather than silently dropped — see `manager-form-sheet.tsx`
 * for the identical reasoning (BC-S's class of limitation applies here too).
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
  // Nullable server-side (`sometimes|nullable|string|max:255`), so an empty
  // string is a legitimate value meaning "no current city set", not an error.
  villeActuelle: z.string().trim().max(255, "This value is too long."),
  numAbonnement: z
    .string()
    .trim()
    .min(1, "Subscription number is required.")
    .max(255, "Subscription number is too long."),
});

type FormValues = z.infer<typeof editSchema>;

type CommercialFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The commercial being edited. Absent = the drawer is closed. */
  commercial?: Commercial;
};

export function CommercialFormSheet({
  open,
  onOpenChange,
  commercial,
}: CommercialFormSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      villeActuelle: "",
      numAbonnement: "",
    },
  });

  const updateMutation = useUpdateCommercialMutation();

  const { has } = usePermission();
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);
  const villesQuery = useVilleOptionsQuery({ enabled: canReadVilles });
  const villes = villesQuery.data ?? [];

  // The field currently registered, so a value the fetched options don't
  // contain can still be rendered rather than silently dropped by a <select>
  // that fails to match it to any <option>.
  const currentVilleActuelle = form.watch("villeActuelle");
  const currentVilleActuelleIsKnown = villes.some(
    (ville) => ville.nomVille === currentVilleActuelle,
  );
  // Only asserted "not in the list" once the list has actually resolved —
  // while it is loading or disabled (no access-dashboard), the value is
  // preserved without claiming to know whether it is legacy or not.
  const villeActuelleFallbackLabel =
    currentVilleActuelle && !currentVilleActuelleIsKnown
      ? villesQuery.isSuccess
        ? `${currentVilleActuelle} (not in the reference list)`
        : currentVilleActuelle
      : undefined;

  // Re-seed on open, or editing one commercial straight after another shows
  // the previous row's values.
  useEffect(() => {
    if (open && commercial) {
      form.reset({
        nom: commercial.nom,
        prenom: commercial.prenom,
        // Both nullable server-side, and confirmed null on a live record
        // (M3.2's exact lesson, applied from the first draft here — never
        // pass a null through to an uncontrolled input's DOM value).
        villeActuelle: commercial.villeActuelle ?? "",
        numAbonnement: commercial.numAbonnement ?? "",
      });
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, commercial?.id]);

  const onSubmit = form.handleSubmit((values) => {
    if (!commercial) return;
    updateMutation.mutate(
      { id: commercial.id, ...values },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to their own fields. `num_d_abonnement` is the wire
  // spelling; `ville_actuelle` carries no such translation (verified from source).
  const error = updateMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const nomError = fieldError("nom");
  const prenomError = fieldError("prenom");
  const villeActuelleError = fieldError("ville_actuelle");
  const numAbonnementError = fieldError("num_d_abonnement");

  const hasFieldError =
    !!nomError || !!prenomError || !!villeActuelleError || !!numAbonnementError;

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
      title="Edit commercial"
      description="Update this commercial's details."
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
        <label htmlFor="villeActuelle" className="text-sm font-medium">
          Current city
        </label>
        <select
          id="villeActuelle"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.villeActuelle || !!villeActuelleError}
          {...form.register("villeActuelle")}
        >
          <option value="">Select a city</option>
          {villeActuelleFallbackLabel ? (
            <option value={currentVilleActuelle}>{villeActuelleFallbackLabel}</option>
          ) : null}
          {villes.map((ville) => (
            <option key={ville.id} value={ville.nomVille}>
              {ville.nomVille}
            </option>
          ))}
        </select>
        {form.formState.errors.villeActuelle ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.villeActuelle.message}
          </p>
        ) : null}
        {villeActuelleError ? (
          <p className="text-destructive text-xs">{villeActuelleError}</p>
        ) : null}
      </div>
    </FormDrawer>
  );
}
