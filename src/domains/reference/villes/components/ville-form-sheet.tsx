import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import {
  useCreateVilleMutation,
  useUpdateVilleMutation,
} from "../queries/villes-queries";
import type { Ville } from "../model/ville";

/**
 * Create/edit drawer (Design System §18: a drawer is a TASK).
 *
 * Its open state is local, not in the URL, and that is the documented rule rather
 * than a shortcut: a drawer that is a transient sub-task of the current page may
 * keep its state local (FTA §5, navigation philosophy). Only the LIST's filters,
 * sort and page belong in the query string.
 *
 * Copy is temporary English pending O-1, matching the M1-C precedent.
 */
const schema = z.object({
  nomVille: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
});

type FormValues = z.infer<typeof schema>;

type VilleFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = create. Present = edit that ville. */
  ville?: Ville;
};

export function VilleFormSheet({ open, onOpenChange, ville }: VilleFormSheetProps) {
  const isEdit = ville !== undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nomVille: "" },
  });

  const createMutation = useCreateVilleMutation();
  const updateMutation = useUpdateVilleMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  // Re-seed whenever the drawer opens, or opening "edit Casablanca" right after
  // "edit Rabat" would show the previous row's name.
  useEffect(() => {
    if (open) {
      form.reset({ nomVille: ville?.nomVille ?? "" });
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ville?.id]);

  const onSubmit = form.handleSubmit((values) => {
    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      updateMutation.mutate({ id: ville.id, nomVille: values.nomVille }, { onSuccess });
    } else {
      createMutation.mutate(values.nomVille, { onSuccess });
    }
  });

  // A duplicate name comes back as a 422 with `errors.nom_ville` — a field
  // problem, so it renders against the field rather than as a banner.
  const error = mutation.error;
  const fieldError = isAppError(error) ? error.fieldErrors?.nom_ville?.[0] : undefined;
  const generalError =
    isAppError(error) && !fieldError && error.kind !== "validation"
      ? "Something went wrong. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit city" : "New city"}
      description={isEdit ? "Rename this city." : "Add a city to the reference data."}
      onSubmit={onSubmit}
      isPending={mutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nomVille" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="nomVille"
          autoFocus
          aria-invalid={!!form.formState.errors.nomVille || !!fieldError}
          {...form.register("nomVille")}
        />
        {form.formState.errors.nomVille ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.nomVille.message}
          </p>
        ) : null}
        {fieldError ? <p className="text-destructive text-xs">{fieldError}</p> : null}
      </div>
    </FormDrawer>
  );
}
