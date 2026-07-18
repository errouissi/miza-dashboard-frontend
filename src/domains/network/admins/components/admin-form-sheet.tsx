import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import {
  useCreateAdminMutation,
  useUpdateAdminMutation,
} from "../queries/admins-queries";
import { ADMIN_PASSWORD_MIN_LENGTH, type Admin } from "../model/admin";

/**
 * Create/edit drawer for an admin.
 *
 * CREATE AND EDIT TAKE DIFFERENT FIELDS, and that is the backend's shape rather
 * than a UI choice: `AdminController::store` requires a password;
 * `AdminController::update` does not accept one at all. So the password field is
 * ABSENT on edit rather than optional — an input the API would ignore is a
 * promise the screen cannot keep.
 *
 * PERMISSIONS ARE NOT MANAGED HERE (M3.1 scope). The backend publishes no
 * catalogue of assignable permissions (BC-M), and an empty-named permission
 * currently exists in the table (BC-D). Rather than hardcode a list, infer one, or
 * filter the defect client-side, the field is absent — the same posture Secteurs
 * and Products take toward capabilities their API does not support.
 *
 * Copy is temporary English pending O-1.
 */
const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(
      ADMIN_PASSWORD_MIN_LENGTH,
      `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`,
    ),
});

const editSchema = createSchema.omit({ password: true });

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;
type FormValues = CreateValues;

type AdminFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = create. Present = edit that admin. */
  admin?: Admin;
};

export function AdminFormSheet({ open, onOpenChange, admin }: AdminFormSheetProps) {
  const isEdit = admin !== undefined;

  const form = useForm<FormValues>({
    // The resolver switches with the mode, so `password` is neither validated nor
    // required when editing.
    resolver: zodResolver(
      isEdit ? (editSchema as unknown as typeof createSchema) : createSchema,
    ),
    defaultValues: { name: "", email: "", password: "" },
  });

  const createMutation = useCreateAdminMutation();
  const updateMutation = useUpdateAdminMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  // Re-seed on open, or editing one admin straight after another shows the
  // previous row's values. The password is always cleared: it is never loaded
  // from the server and must not survive a reopen.
  useEffect(() => {
    if (open) {
      form.reset({
        name: admin?.name ?? "",
        email: admin?.email ?? "",
        password: "",
      });
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, admin?.id]);

  const onSubmit = form.handleSubmit((values) => {
    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      const input: EditValues = { name: values.name, email: values.email };
      updateMutation.mutate({ id: admin.id, ...input }, { onSuccess });
    } else {
      createMutation.mutate(values, { onSuccess });
    }
  });

  // Field-level 422s map to their own fields — a duplicate email is the common one.
  const error = mutation.error;
  const nameError = isAppError(error) ? error.fieldErrors?.name?.[0] : undefined;
  const emailError = isAppError(error) ? error.fieldErrors?.email?.[0] : undefined;
  const passwordError = isAppError(error) ? error.fieldErrors?.password?.[0] : undefined;
  const generalError =
    isAppError(error) &&
    !nameError &&
    !emailError &&
    !passwordError &&
    error.kind !== "validation"
      ? // A 403 here means the backend refused the record itself (it guards
        // super-admin edits), which is a different fact from a validation failure.
        error.kind === "permission"
        ? "This account cannot be modified."
        : "Something went wrong. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit admin" : "New admin"}
      description={
        isEdit
          ? "Update this administrator's details."
          : "Create a dashboard administrator account."
      }
      onSubmit={onSubmit}
      isPending={mutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          autoFocus
          aria-invalid={!!form.formState.errors.name || !!nameError}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
        ) : null}
        {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          aria-invalid={!!form.formState.errors.email || !!emailError}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        ) : null}
        {emailError ? <p className="text-destructive text-xs">{emailError}</p> : null}
      </div>

      {/* Create only — the update endpoint accepts no password. */}
      {isEdit ? null : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password || !!passwordError}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.password.message}
            </p>
          ) : null}
          {passwordError ? (
            <p className="text-destructive text-xs">{passwordError}</p>
          ) : null}
        </div>
      )}
    </FormDrawer>
  );
}
