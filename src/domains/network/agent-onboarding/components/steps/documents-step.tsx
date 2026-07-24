import { Controller, useFormContext } from "react-hook-form";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import {
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  type AgentOnboardingFormValues,
} from "../../model/agent-onboarding";

/**
 * Step 2 — Documents. Five required uploads, two optional. Named slots
 * throughout (Design System §12) — never one anonymous bucket. 2MB cap
 * stated exactly (verified from source — no field is 5MB, see the model
 * docblock), and the MIME split is exact: `photo`/CIN recto/verso are
 * images only; every other document also accepts PDF.
 */
export function DocumentsStep() {
  const {
    control,
    formState: { errors },
  } = useFormContext<AgentOnboardingFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={control}
        name="photo"
        render={({ field }) => (
          <FileUploadField
            label="Photo"
            required
            accept={IMAGE_ACCEPT}
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.photo?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="photoCinRecto"
        render={({ field }) => (
          <FileUploadField
            label="CIN — front"
            required
            accept={IMAGE_ACCEPT}
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.photoCinRecto?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="photoCinVerso"
        render={({ field }) => (
          <FileUploadField
            label="CIN — back"
            required
            accept={IMAGE_ACCEPT}
            helperText="JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.photoCinVerso?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="certificatDHabitat"
        render={({ field }) => (
          <FileUploadField
            label="Habitat certificate"
            required
            accept={DOCUMENT_ACCEPT}
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.certificatDHabitat?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="carteAutoEntrepreneur"
        render={({ field }) => (
          <FileUploadField
            label="Auto-entrepreneur card"
            required
            accept={DOCUMENT_ACCEPT}
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.carteAutoEntrepreneur?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="ficheAntroprometrique"
        render={({ field }) => (
          <FileUploadField
            label="Anthropometric form"
            required={false}
            accept={DOCUMENT_ACCEPT}
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.ficheAntroprometrique?.message as string | undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="ficheDIncidentBanquaire"
        render={({ field }) => (
          <FileUploadField
            label="Bank incident form"
            required={false}
            accept={DOCUMENT_ACCEPT}
            helperText="PDF, JPEG or PNG, up to 2MB."
            value={field.value}
            onChange={field.onChange}
            error={errors.ficheDIncidentBanquaire?.message as string | undefined}
          />
        )}
      />
    </div>
  );
}
