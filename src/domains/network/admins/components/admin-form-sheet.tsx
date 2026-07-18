import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import {
  useAssignablePermissionsQuery,
  useCreateAdminMutation,
  useUpdateAdminMutation,
} from "../queries/admins-queries";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  type Admin,
  type AssignablePermission,
} from "../model/admin";

/**
 * Create/edit drawer for an admin.
 *
 * CREATE AND EDIT TAKE DIFFERENT FIELDS, and that is the backend's shape rather
 * than a UI choice: `AdminController::store` requires a password;
 * `AdminController::update` does not accept one at all. So the password field is
 * ABSENT on edit rather than optional — an input the API would ignore is a
 * promise the screen cannot keep.
 *
 * THE PERMISSION SELECTOR IS DOMAIN-OWNED, and its options come exclusively from
 * the backend catalogue (`GET /admin/permissions`, B-6). Nothing is hardcoded,
 * inferred, or derived from any user's own grants — the backend's own note records
 * that deriving it from the super-admin was lossy, since `create-grattage-sale` is
 * seeded after the super-admin sync and so never appeared in that list.
 *
 * No shared picker abstraction: this is one caller, and a generic multi-select
 * would be an abstraction fitted to an imagined second one.
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
  // Permission NAMES. Not validated against the catalogue here: the catalogue is
  // the server's own list and the server re-validates with Rule::exists, so a
  // client-side membership check would duplicate an authority it does not hold.
  permissions: z.array(z.string()),
});

const editSchema = createSchema.omit({ password: true });

type CreateValues = z.infer<typeof createSchema>;
type FormValues = CreateValues;

/** Order-insensitive set comparison — selection order is not part of the payload. */
function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * Sections the catalogue by its `group` for display.
 *
 * Group HEADINGS are sorted alphabetically so the layout is stable across
 * reloads. Entries WITHIN a group keep the backend's order (name ASC) — the
 * catalogue's ordering is its contract, and re-sorting the items would replace
 * the server's answer with ours.
 */
function groupCatalogue(
  catalogue: readonly AssignablePermission[],
): [string, AssignablePermission[]][] {
  const groups = new Map<string, AssignablePermission[]>();
  for (const permission of catalogue) {
    const bucket = groups.get(permission.group);
    if (bucket) bucket.push(permission);
    else groups.set(permission.group, [permission]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

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
    defaultValues: { name: "", email: "", password: "", permissions: [] },
  });

  const createMutation = useCreateAdminMutation();
  const updateMutation = useUpdateAdminMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  // Fetched only while the drawer is open. The catalogue endpoint is gated on
  // create-admin|update-admin whereas the LIST is gated on access-dashboard, so
  // firing it on page mount would 403 for every read-only operator.
  const catalogueQuery = useAssignablePermissionsQuery({ enabled: open });
  const catalogue = catalogueQuery.data ?? [];

  /** What the admin held when the drawer opened — the baseline for "did it change". */
  const seededPermissions = admin?.permissions ?? [];
  const selectedPermissions = form.watch("permissions") ?? [];

  // Re-seed on open, or editing one admin straight after another shows the
  // previous row's values. The password is always cleared: it is never loaded
  // from the server and must not survive a reopen.
  useEffect(() => {
    if (open) {
      form.reset({
        name: admin?.name ?? "",
        email: admin?.email ?? "",
        password: "",
        permissions: admin?.permissions ?? [],
      });
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, admin?.id]);

  const togglePermission = (name: string, checked: boolean) => {
    const current = form.getValues("permissions") ?? [];
    form.setValue(
      "permissions",
      checked ? [...current, name] : current.filter((value) => value !== name),
      { shouldDirty: true },
    );
  };

  const onSubmit = form.handleSubmit((values) => {
    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      // `permissions` is sent ONLY when the selection actually changed. The
      // backend applies sync semantics whenever the key is present, so sending it
      // unconditionally would let a rename replace the whole permission set —
      // including anything the catalogue does not represent.
      const changed = !sameSelection(values.permissions, seededPermissions);
      updateMutation.mutate(
        {
          id: admin.id,
          name: values.name,
          email: values.email,
          ...(changed ? { permissions: values.permissions } : {}),
        },
        { onSuccess },
      );
    } else {
      createMutation.mutate(values, { onSuccess });
    }
  });

  // Field-level 422s map to their own fields — a duplicate email is the common one.
  const error = mutation.error;
  const nameError = isAppError(error) ? error.fieldErrors?.name?.[0] : undefined;
  const emailError = isAppError(error) ? error.fieldErrors?.email?.[0] : undefined;
  const passwordError = isAppError(error) ? error.fieldErrors?.password?.[0] : undefined;
  // Laravel reports `permissions.*` failures against the indexed key, so both
  // shapes are read — `permissions` for an array-level failure, `permissions.0`
  // and friends for a rejected member.
  const permissionsError = isAppError(error)
    ? (error.fieldErrors?.permissions?.[0] ??
      Object.entries(error.fieldErrors ?? {}).find(([key]) =>
        key.startsWith("permissions."),
      )?.[1]?.[0])
    : undefined;
  const generalError =
    isAppError(error) &&
    !nameError &&
    !emailError &&
    !passwordError &&
    !permissionsError &&
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

      {/* The permission selector — domain-owned, no shared picker abstraction.
          Options come exclusively from the backend catalogue (B-6); nothing is
          hardcoded, inferred, or derived from any user's own grants. */}
      <fieldset className="flex flex-col gap-2 border-t pt-4">
        <legend className="sr-only">Permissions</legend>
        <span className="text-sm font-medium">Permissions</span>

        {catalogueQuery.isPending ? (
          <p className="text-muted-foreground text-xs">Loading permissions…</p>
        ) : catalogueQuery.isError ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-destructive text-xs">
              The permission list could not be loaded.
            </p>
            <button
              type="button"
              className="text-primary text-xs underline underline-offset-4"
              onClick={() => void catalogueQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : catalogue.length === 0 ? (
          // A catalogue with no entries is a backend state, not an error. Say so
          // plainly rather than rendering an empty box.
          <p className="text-muted-foreground text-xs">
            No assignable permissions are available.
          </p>
        ) : (
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
            {groupCatalogue(catalogue).map(([group, entries]) => (
              <div key={group} className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium">{group}</span>
                {entries.map((permission) => (
                  <label
                    key={permission.name}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selectedPermissions.includes(permission.name)}
                      onChange={(event) =>
                        togglePermission(permission.name, event.target.checked)
                      }
                    />
                    {permission.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {permissionsError ? (
          <p className="text-destructive text-xs">{permissionsError}</p>
        ) : null}
      </fieldset>

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
