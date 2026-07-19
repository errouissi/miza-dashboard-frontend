import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useUpdateManagerMutation } from "../queries/managers-queries";
import type { Manager } from "../model/manager";

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
 * Copy is temporary English pending O-1.
 */
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
        villeSousResponsabilite: manager.villeSousResponsabilite ?? "",
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
        <Input
          id="ville"
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
        <label htmlFor="villeSousResponsabilite" className="text-sm font-medium">
          Area of responsibility
        </label>
        <Input
          id="villeSousResponsabilite"
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
    </FormDrawer>
  );
}
