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
import { useUpdateClientMutation } from "../queries/clients-queries";
import type { Client } from "../model/client";

/**
 * Edit drawer for a client.
 *
 * TWO FIELDS ONLY — `phone` and `ville` — narrower even than Commercials'
 * four-field form. `ClientController::update` also accepts `status`
 * (excluded: owned by the status-toggle action, which can never be told to
 * set `pending` either — see `client-status-dialog.tsx`) and paired
 * `latitude`/`longitude` (map features, explicitly out of scope for this
 * milestone). There is no create mode: Create Client is explicitly excluded
 * from this milestone's scope, not deferred for a file-upload reason the way
 * the Agent wizard was.
 *
 * `phone` MIRRORS THE BACKEND'S OWN REGEX, verified from source
 * (`ClientController::update`: `/^(\+212|0)[5-7][0-9]{8}$/`, a
 * Morocco-compatible mobile/landline pattern) — not invented. This narrows
 * but does not close a real gap: `update()`'s `$request->validate()` sits
 * inside a bare `catch (\Exception)` with no `ValidationException`
 * carve-out, so ANY validation failure — including a DUPLICATE phone, which
 * cannot be predicted client-side — returns 500, not 422. Format-checking
 * client-side keeps the FORMAT half of that gap unreachable; the
 * uniqueness half is not something a regex can close. Worth a backend
 * consultation item; not fixed here.
 *
 * `ville` IS A SELECT, SOURCED FROM VILLES — the identical pattern as
 * Managers'/Commercials' city fields, for the identical reason
 * (`scopeByVille` is an exact match, not partial). The payload is still the
 * city's NAME, not a Villes id — verified from source (`clients.ville` is a
 * plain column, no foreign key). Gated on `access-dashboard` via `enabled`
 * on the shared query, because this drawer's `children` render whenever the
 * list page does (`FormDrawer` owns only the shell) — unlike the list
 * filter, which the page mounts conditionally.
 *
 * `ville` IS REQUIRED HERE (`min(1)`) despite being nullable on read — the
 * same BC-U-class gap Managers' `ville` has: the update validator has no
 * `nullable` for `ville_comercial`, so an empty string (converted from `""`
 * by Laravel's global `ConvertEmptyStringsToNull`) is rejected. A current
 * value absent from the fetched Villes options is never silently dropped —
 * rendered as an extra, honestly labelled option, exactly as Managers'
 * `ville` field already does.
 *
 * Copy is temporary English pending O-1.
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PHONE_REGEX = /^(\+212|0)[5-7][0-9]{8}$/;

const editSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .regex(PHONE_REGEX, "Enter a valid Moroccan phone number (e.g. 0612345678)."),
  ville: z.string().trim().min(1, "City is required.").max(255, "City is too long."),
});

type FormValues = z.infer<typeof editSchema>;

type ClientFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client being edited. Absent = the drawer is closed. */
  client?: Client;
};

export function ClientFormSheet({ open, onOpenChange, client }: ClientFormSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      phone: "",
      ville: "",
    },
  });

  const updateMutation = useUpdateClientMutation();

  const { has } = usePermission();
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);
  const villesQuery = useVilleOptionsQuery({ enabled: canReadVilles });
  const villes = villesQuery.data ?? [];

  // The field currently registered, so a value the fetched options don't
  // contain can still be rendered rather than silently dropped by a
  // <select> that fails to match it to any <option>.
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

  // Re-seed on open, or editing one client straight after another shows the
  // previous row's values.
  useEffect(() => {
    if (open && client) {
      form.reset({
        phone: client.phone,
        // Nullable server-side; a null becomes an empty string — never
        // passed through raw to an uncontrolled <select>'s DOM value.
        ville: client.ville ?? "",
      });
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  const onSubmit = form.handleSubmit((values) => {
    if (!client) return;
    updateMutation.mutate(
      { id: client.id, ...values },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to their own fields. `ville_comercial` is the wire
  // spelling, verified from source — `phone` carries no such translation.
  const error = updateMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const phoneError = fieldError("phone");
  const villeError = fieldError("ville_comercial");

  const hasFieldError = !!phoneError || !!villeError;

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
      title="Edit client"
      description="Update this client's details."
      onSubmit={onSubmit}
      isPending={updateMutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Phone
        </label>
        <Input
          id="phone"
          autoFocus
          aria-invalid={!!form.formState.errors.phone || !!phoneError}
          {...form.register("phone")}
        />
        {form.formState.errors.phone ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.phone.message}
          </p>
        ) : null}
        {phoneError ? <p className="text-destructive text-xs">{phoneError}</p> : null}
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
    </FormDrawer>
  );
}
