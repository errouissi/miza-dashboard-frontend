import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { useSecteursQuery } from "@/domains/reference/secteurs";
import { useVilleOptionsQuery } from "@/domains/reference/villes";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useUpdateClientMutation } from "../queries/clients-queries";

/**
 * Edit drawer for a client — SHARED between the Clients list (M3.4) and the
 * Client 360 workspace (M7 Phase 1's own Edit action), not a second
 * implementation: `client` is typed structurally (see `EditableClient`
 * below), satisfied by both the list's own `Client` row and the workspace's
 * `ClientDetail`.
 *
 * THREE FIELDS — `phone`, `ville` and `secteur` (M7 Phase 1 widened the
 * original `phone`/`ville` pair with `secteur`, per the Client 360
 * discovery follow-up's Edit field-matrix decision). `ClientController::update`
 * also accepts `status` (excluded: owned by the status-toggle action, which
 * can never be told to set `pending` either — see `client-status-dialog.tsx`),
 * paired `latitude`/`longitude` (map features, explicitly out of scope), and
 * does NOT accept `agent_id` at all (confirmed from source — Commercial
 * assignment/reassignment is `assign`/`reassign`/`assignBulk`/`unassign`, a
 * dedicated workflow never mixed into this generic edit; Client 360 Phase
 * 2's own concern). There is no create mode: Create Client is explicitly
 * excluded from this milestone's scope, not deferred for a file-upload
 * reason the way the Agent wizard was — confirmed unchanged this phase (no
 * `store()` caller exists anywhere in this domain).
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
 * `secteur` IS A SELECT TOO, SOURCED FROM SECTEURS AND SCOPED TO THE
 * SELECTED CITY — the SAME `useSecteursQuery({ villeId })` mechanism the
 * agent-onboarding wizard's Identity step already established
 * (`domains/network/agent-onboarding/components/steps/identity-step.tsx`),
 * not a second implementation. `villeId` is resolved from the selected
 * `ville` NAME against the already-fetched Villes list — `secteurs.ville_id`
 * is a real foreign key (unlike `clients.secteur`, which has none). THE
 * PAYLOAD IS UNCHANGED: the value submitted is still the sector's NAME, a
 * plain string, exactly what a free-text field would have sent.
 *
 * `ville`/`secteur` ARE BOTH REQUIRED HERE (`min(1)`) despite being nullable
 * on read — the same BC-U-class gap Managers' `ville` has: neither update
 * validator has `nullable`, so an empty string (converted from `""` by
 * Laravel's global `ConvertEmptyStringsToNull`) is rejected. A current value
 * absent from the fetched options is never silently dropped for EITHER
 * field — both render an extra, honestly labelled fallback option, only
 * asserted "not in the reference list" once the relevant query has actually
 * resolved (identical discipline, two independent fallbacks).
 *
 * CHANGING THE CITY CLEARS THE SELECTED SECTOR — a sector chosen for one
 * city is never silently carried into another. NOT a `useEffect` keyed on
 * the watched city value — the wizard's own `useEffect(() => setValue(...),
 * [selectedVilleId])` pattern is UNSAFE here: this form, unlike the wizard,
 * SEEDS an existing ville+secteur pair via `form.reset()` before the Villes
 * list has resolved, and a `useEffect` watching the derived Villes-lookup id
 * (or even the watched NAME field) fires in the SAME commit as the seeding
 * effect, racing it — confirmed empirically (a first implementation here hit
 * exactly this: the just-seeded secteur was wiped the instant the dialog
 * opened). Instead, the clear is wired directly into the City `<select>`'s
 * own `onChange`, composed on top of `form.register("ville")`'s own handler
 * — it fires ONLY on a genuine operator interaction with the control, never
 * as a side effect of `form.reset()` (which never dispatches a change
 * event) and never merely because the Villes/Secteurs lists resolved.
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
  secteur: z
    .string()
    .trim()
    .min(1, "Sector is required.")
    .max(255, "Sector is too long."),
});

type FormValues = z.infer<typeof editSchema>;

/**
 * Structural, not `Client`/`ClientDetail` — this is the whole reason the
 * SAME component works from both the list (`Client`) and the Client 360
 * workspace (`ClientDetail`): both satisfy this shape, so no adapter or
 * union prop type is needed (ADR-0008's discipline, applied to a shared
 * component's prop instead of a wire mapper).
 */
type EditableClient = {
  id: number;
  phone: string;
  ville: string | null;
  secteur: string | null;
};

type ClientFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client being edited. Absent = the drawer is closed. */
  client?: EditableClient;
};

export function ClientFormSheet({ open, onOpenChange, client }: ClientFormSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      phone: "",
      ville: "",
      secteur: "",
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

  // Resolved from the city NAME against the already-fetched Villes list —
  // `secteurs.ville_id` is a real foreign key, unlike `clients.secteur`, so
  // this is how Secteur's OPTIONS are scoped to a city without changing
  // what gets submitted.
  const selectedVilleId = villes.find((ville) => ville.nomVille === currentVille)?.id;
  const secteursQuery = useSecteursQuery(
    { villeId: selectedVilleId },
    { enabled: canReadVilles && selectedVilleId !== undefined },
  );
  const secteurs = secteursQuery.data ?? [];

  // Same honest-fallback discipline as `villeFallbackLabel` above: a seeded
  // legacy secteur absent from the current city's options (`clients.secteur`
  // has no FK — BC-V) is never silently dropped from the <select>, only
  // asserted "not in the reference list" once the Secteurs read for the
  // CURRENT city has actually resolved.
  const currentSecteur = form.watch("secteur");
  const currentSecteurIsKnown = secteurs.some(
    (secteur) => secteur.nomSecteur === currentSecteur,
  );
  const secteurFallbackLabel =
    currentSecteur && !currentSecteurIsKnown
      ? secteursQuery.isSuccess
        ? `${currentSecteur} (not in the reference list)`
        : currentSecteur
      : undefined;

  /**
   * RE-SYNCS THE SECTEUR `<select>`'S DOM VALUE ONCE ITS OPTIONS ARRIVE —
   * a genuine, empirically-confirmed timing gap, not defensive padding.
   * `secteursQuery` starts DISABLED (no city selected yet) and only fires
   * once `form.reset()` has already set `ville` (and, in the same reset,
   * `secteur`) on the uncontrolled `<select>`'s DOM node via its ref —
   * `secteur`'s own `<option>` does not exist in the DOM at that moment
   * (its options come from THIS query, which has not resolved yet), so the
   * browser's native `<select>` silently keeps its OWN visual selection at
   * the blank placeholder, even though RHF's internal form state correctly
   * holds "Maarif" the whole time (`form.watch("secteur")` proves this — it
   * never lost the value). Once matching options exist, re-applying the
   * SAME value through `setValue` (not `reset`, no side effects on other
   * fields) makes RHF re-sync the ref's DOM value against the option that
   * now exists — the standard fix for this exact class of async-populated
   * `<select>` gap. `ville` does not need this: its own Villes query is
   * unscoped and already mounted for the whole page, so by the time a
   * dialog opens its options are already resolved in every observed case.
   */
  useEffect(() => {
    if (secteursQuery.data) {
      form.setValue("secteur", form.getValues("secteur"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secteursQuery.data]);

  // Re-seed on open, or editing one client straight after another shows the
  // previous row's values.
  useEffect(() => {
    if (open && client) {
      form.reset({
        phone: client.phone,
        // Nullable server-side; a null becomes an empty string — never
        // passed through raw to an uncontrolled <select>'s DOM value.
        ville: client.ville ?? "",
        secteur: client.secteur ?? "",
      });
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  // `register("ville")`'s own onChange, composed with the Secteur-clearing
  // side effect — see the module docblock for why this is an onChange
  // handler and not a `useEffect`.
  const villeField = form.register("ville");
  const onVilleChange: typeof villeField.onChange = (event) => {
    const result = villeField.onChange(event);
    form.setValue("secteur", "", { shouldValidate: true, shouldDirty: true });
    return result;
  };

  const onSubmit = form.handleSubmit((values) => {
    if (!client) return;
    updateMutation.mutate(
      { id: client.id, ...values },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to their own fields. `ville_comercial`/
  // `secteur_comercial` are the wire spellings, verified from source —
  // `phone` carries no such translation.
  const error = updateMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const phoneError = fieldError("phone");
  const villeError = fieldError("ville_comercial");
  const secteurError = fieldError("secteur_comercial");

  const hasFieldError = !!phoneError || !!villeError || !!secteurError;

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
          {...villeField}
          onChange={onVilleChange}
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
        <label htmlFor="secteur" className="text-sm font-medium">
          Sector
        </label>
        <select
          id="secteur"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.secteur || !!secteurError}
          disabled={!selectedVilleId}
          {...form.register("secteur")}
        >
          <option value="">
            {selectedVilleId ? "Select a sector" : "Select a city first"}
          </option>
          {secteurFallbackLabel ? (
            <option value={currentSecteur}>{secteurFallbackLabel}</option>
          ) : null}
          {secteurs.map((secteur) => (
            <option key={secteur.id} value={secteur.nomSecteur}>
              {secteur.nomSecteur}
            </option>
          ))}
        </select>
        {form.formState.errors.secteur ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.secteur.message}
          </p>
        ) : null}
        {secteurError ? <p className="text-destructive text-xs">{secteurError}</p> : null}
      </div>
    </FormDrawer>
  );
}
