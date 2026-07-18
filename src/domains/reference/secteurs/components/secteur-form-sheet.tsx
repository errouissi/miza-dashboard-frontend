import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import type { Ville } from "@/domains/reference/villes";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import {
  useCreateSecteurMutation,
  useUpdateSecteurMutation,
} from "../queries/secteurs-queries";
import type { Secteur } from "../model/secteur";

/**
 * Create/edit drawer (Design System §18: a drawer is a TASK).
 *
 * Villes arrive as a PROP, not from a query of this component's own. The page owns
 * the single ville read and passes it down, so the picker and the list's relation
 * column are the same data — one fetch, one cache entry, no second copy of ville
 * names living in this domain.
 *
 * Copy is temporary English pending O-1, matching the Villes precedent.
 */
const schema = z.object({
  nomSecteur: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
  // Coerced: a <select> yields a string, the API takes an integer FK.
  villeId: z.coerce.number().int().positive("City is required."),
});

type FormValues = z.input<typeof schema>;

type SecteurFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = create. Present = edit that secteur. */
  secteur?: Secteur;
  /** Picker options, owned by the page. Empty while the ville read is in flight. */
  villes: Ville[];
};

export function SecteurFormSheet({
  open,
  onOpenChange,
  secteur,
  villes,
}: SecteurFormSheetProps) {
  const isEdit = secteur !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nomSecteur: "", villeId: "" },
  });

  const createMutation = useCreateSecteurMutation();
  const updateMutation = useUpdateSecteurMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  // Re-seed on open, or editing one secteur straight after another shows the
  // previous row's values.
  useEffect(() => {
    if (open) {
      form.reset({
        nomSecteur: secteur?.nomSecteur ?? "",
        villeId: secteur?.villeId ?? "",
      });
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, secteur?.id]);

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      nomSecteur: String(values.nomSecteur).trim(),
      villeId: Number(values.villeId),
    };
    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      updateMutation.mutate({ id: secteur.id, ...input }, { onSuccess });
    } else {
      createMutation.mutate(input, { onSuccess });
    }
  });

  // Uniqueness is COMPOSITE server-side (nom_secteur per ville_id), but Laravel
  // reports it against `nom_secteur` — so it lands on the name field even though
  // the conflict involves the city.
  const error = mutation.error;
  const nameError = isAppError(error) ? error.fieldErrors?.nom_secteur?.[0] : undefined;
  const villeError = isAppError(error) ? error.fieldErrors?.ville_id?.[0] : undefined;
  const generalError =
    isAppError(error) && !nameError && !villeError && error.kind !== "validation"
      ? "Something went wrong. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit sector" : "New sector"}
      description={isEdit ? "Rename this sector or move it." : "Add a sector to a city."}
      onSubmit={onSubmit}
      isPending={mutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nomSecteur" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="nomSecteur"
          autoFocus
          aria-invalid={!!form.formState.errors.nomSecteur || !!nameError}
          {...form.register("nomSecteur")}
        />
        {form.formState.errors.nomSecteur ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.nomSecteur.message}
          </p>
        ) : null}
        {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="villeId" className="text-sm font-medium">
          City
        </label>
        <select
          id="villeId"
          aria-invalid={!!form.formState.errors.villeId || !!villeError}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={villes.length === 0}
          {...form.register("villeId")}
        >
          <option value="">Select a city…</option>
          {villes.map((ville) => (
            <option key={ville.id} value={ville.id}>
              {ville.nomVille}
            </option>
          ))}
        </select>
        {form.formState.errors.villeId ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.villeId.message}
          </p>
        ) : null}
        {villeError ? <p className="text-destructive text-xs">{villeError}</p> : null}
      </div>
    </FormDrawer>
  );
}
