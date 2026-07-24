import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import {
  DOCUMENT_ACCEPT,
  MOTO_TYPES,
  MOTO_TYPE_LABELS,
  type AgentOnboardingFormValues,
} from "../../model/agent-onboarding";
import { FileUploadField } from "../file-upload-field";
import { TextField } from "../text-field";

/**
 * Step 4 — Motorcycle. Entirely conditional on `has_moto`: a checkbox
 * (Design System §12 — an independent yes/no fact, not a toggle, since this
 * is inside a submitted form), then, only when checked, the moto type radio,
 * chassis number, and 4 required documents. All four moto fields are
 * `required_if:has_moto` server-side — mirrored exactly in the schema, not
 * approximated.
 *
 * `montantEssence` ("Fuel amount") LIVES HERE TOO, NOT ONLY IN VALIDATION —
 * moved off Financial during M3.6's manual-validation review. It is only
 * ever meaningful for a GAS motorcycle (`hasMoto && typeMoto === "essance"`):
 * `AgentController::store`'s manual business-rule check forces it to exactly
 * 0 for every other combination (no motorcycle, or an electric one), mirrored
 * in the schema's `superRefine`. Showing an editable field the backend would
 * silently zero out was the exact confusion this move fixes — the input is
 * now rendered, and editable, only when its value can legitimately be
 * anything other than 0. The effect below force-syncs it back to "0" the
 * instant that condition stops holding, so a nonzero amount entered while
 * Gas was selected is never silently carried over (and submitted) after the
 * operator switches to Electric or unchecks "has motorcycle" entirely.
 */
export function MotoStep() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<AgentOnboardingFormValues>();
  const hasMoto = watch("hasMoto");
  const typeMoto = watch("typeMoto");
  const isGasMoto = hasMoto && typeMoto === "essance";

  useEffect(() => {
    if (!isGasMoto) {
      setValue("montantEssence", "0", { shouldValidate: true, shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGasMoto]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" {...register("hasMoto")} />
        This agent has a motorcycle
      </label>

      {hasMoto ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Motorcycle type</legend>
            <div className="flex gap-4">
              {MOTO_TYPES.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input type="radio" value={option} {...register("typeMoto")} />
                  {MOTO_TYPE_LABELS[option]}
                </label>
              ))}
            </div>
            {errors.typeMoto ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.typeMoto.message}
              </p>
            ) : null}
          </fieldset>

          {isGasMoto ? (
            <TextField
              name="montantEssence"
              label="Fuel amount (MAD)"
              register={register}
              error={errors.montantEssence?.message}
            />
          ) : null}

          <TextField
            name="numDeChassis"
            label="Chassis number"
            register={register}
            error={errors.numDeChassis?.message}
          />

          <Controller
            control={control}
            name="cartGriseRecto"
            render={({ field }) => (
              <FileUploadField
                label="Registration card — front"
                required
                accept={DOCUMENT_ACCEPT}
                helperText="PDF, JPEG or PNG, up to 2MB."
                value={field.value}
                onChange={field.onChange}
                error={errors.cartGriseRecto?.message as string | undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="cartGriseVerso"
            render={({ field }) => (
              <FileUploadField
                label="Registration card — back"
                required
                accept={DOCUMENT_ACCEPT}
                helperText="PDF, JPEG or PNG, up to 2MB."
                value={field.value}
                onChange={field.onChange}
                error={errors.cartGriseVerso?.message as string | undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="assurance"
            render={({ field }) => (
              <FileUploadField
                label="Insurance"
                required
                accept={DOCUMENT_ACCEPT}
                helperText="PDF, JPEG or PNG, up to 2MB."
                value={field.value}
                onChange={field.onChange}
                error={errors.assurance?.message as string | undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="engagementMoto"
            render={({ field }) => (
              <FileUploadField
                label="Engagement letter"
                required
                accept={DOCUMENT_ACCEPT}
                helperText="PDF, JPEG or PNG, up to 2MB."
                value={field.value}
                onChange={field.onChange}
                error={errors.engagementMoto?.message as string | undefined}
              />
            )}
          />
        </>
      ) : null}
    </div>
  );
}
