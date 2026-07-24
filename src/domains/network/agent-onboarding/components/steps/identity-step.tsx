import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import {
  ManagerAreaMultiSelect,
  useManagerOptionsQuery,
} from "@/domains/network/managers";
import { useSecteursQuery } from "@/domains/reference/secteurs";
import { useVilleOptionsQuery, type Ville } from "@/domains/reference/villes";
import {
  AGENT_ROLE_LABELS,
  AGENT_ROLES,
  type AgentOnboardingFormValues,
} from "../../model/agent-onboarding";
import { TextField } from "../text-field";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * A current value absent from the Villes options is rendered as an extra,
 * clearly labelled option rather than silently dropped — the identical
 * BC-S-class reasoning `ManagerFormSheet`/`CommercialFormSheet` already
 * apply, only asserted "not in the reference list" once the options have
 * actually resolved.
 */
function villeFallbackOption(
  current: string,
  villes: Ville[],
  resolved: boolean,
): string | undefined {
  if (!current || villes.some((ville) => ville.nomVille === current)) return undefined;
  return resolved ? `${current} (not in the reference list)` : current;
}

/**
 * Step 1 — Identity. Role is a radio (2 mutually exclusive, always-visible
 * choices, Design System §12), preselected by whichever "Create…" button the
 * operator came from, but still changeable here.
 *
 * `ville`/`villeActuelle` ARE VILLES-BACKED SELECTS, NOT FREE TEXT — found
 * during M3.6's manual-validation review: every other city field in Network
 * (Managers'/Commercials' own edit forms) already renders this way, and the
 * wizard's Identity step had drifted from that pattern. Same payload
 * contract as everywhere else (the city's NAME, not a Villes id), gated on
 * `access-dashboard` via `enabled` — this step is always mounted once the
 * wizard route is, so the query must not fire for an operator who would 403
 * on `GET /admin/villes`.
 *
 * `villeSousResponsabilite` REUSES `ManagerAreaMultiSelect` (Managers'
 * public surface, `managers/index.ts`) — the SAME component and behavior
 * `ManagerFormSheet` uses, not a second implementation of the same idea.
 *
 * `secteur` (commercial only) IS A SELECT, SOURCED FROM SECTEURS AND SCOPED
 * TO THE SELECTED CURRENT CITY — found during M3.6's manual-validation
 * review. Secteurs' own public surface (`secteurs/index.ts`) exports
 * `useSecteursQuery`, the SAME hook `SecteursListPage`'s own city filter
 * already uses, called here with `{ villeId }` resolved from `villeActuelle`
 * (a NAME) against the already-fetched Villes list. Changing the city clears
 * the selected sector and re-scopes the query (its queryKey carries the
 * filter) — a sector chosen for one city is never silently carried into
 * another. THE PAYLOAD IS UNCHANGED: `agents.secteur` has no foreign key to
 * `secteurs` (BC-V), so the value submitted is still the sector's NAME, a
 * plain string, exactly as the free-text input used to send.
 *
 * `manager_id` reuses Managers' existing `useManagerOptionsQuery` picker —
 * the SAME bounded `<select>` pattern Commercials' own manager filter
 * already uses, not the product's first async entity-chip picker (see the
 * model docblock — an explicit, approved narrowing of Design System §12's
 * own rule, not an oversight).
 *
 * KNOWN, ACCEPTED GAP: `useManagerOptionsQuery` has no `enabled` gate (unlike
 * `useVilleOptionsQuery`), because its one prior caller (Commercials) shares
 * `view-agents` with the endpoint it reads. This wizard is gated on
 * `create-agent`, a DIFFERENT permission — a session holding `create-agent`
 * without `view-agents` would 403 on this query. Not fixed here: modifying
 * Managers' public surface is out of this milestone's scope
 * (`domains/network/agent-onboarding` stays local, per its own decision
 * record).
 */
export function IdentityStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<AgentOnboardingFormValues>();
  const role = watch("role");

  const managersQuery = useManagerOptionsQuery();
  const managers = managersQuery.data ?? [];

  const { has } = usePermission();
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);
  const villesQuery = useVilleOptionsQuery({ enabled: canReadVilles });
  const villes = villesQuery.data ?? [];

  const currentVille = watch("ville");
  const villeFallbackLabel = villeFallbackOption(
    currentVille,
    villes,
    villesQuery.isSuccess,
  );

  const currentVilleActuelle = watch("villeActuelle") ?? "";
  const villeActuelleFallbackLabel = villeFallbackOption(
    currentVilleActuelle,
    villes,
    villesQuery.isSuccess,
  );

  // Resolved from the city NAME against the already-fetched Villes list —
  // `secteurs.ville_id` is a real foreign key, unlike `agents.secteur`
  // (BC-V), so this is how the wizard scopes sector OPTIONS to a city
  // without changing what gets submitted.
  const selectedVilleId = villes.find(
    (ville) => ville.nomVille === currentVilleActuelle,
  )?.id;
  const secteursQuery = useSecteursQuery(
    { villeId: selectedVilleId },
    { enabled: canReadVilles && role === "commercial" && selectedVilleId !== undefined },
  );
  const secteurs = secteursQuery.data ?? [];

  // Changing the Current City clears whichever sector was selected for the
  // PREVIOUS city — a sector never silently survives a city change it no
  // longer belongs to. Reloading the options themselves needs no separate
  // effect: `useSecteursQuery`'s queryKey already carries `villeId`, so
  // TanStack Query refetches on its own the instant `selectedVilleId` changes.
  useEffect(() => {
    setValue("secteur", "", { shouldValidate: true, shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVilleId]);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Role</legend>
        <div className="flex gap-4">
          {AGENT_ROLES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input type="radio" value={option} {...register("role")} />
              {AGENT_ROLE_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        name="nom"
        label="Last name"
        register={register}
        error={errors.nom?.message}
      />
      <TextField
        name="prenom"
        label="First name"
        register={register}
        error={errors.prenom?.message}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ville" className="text-sm font-medium">
          City
        </label>
        <select
          id="ville"
          className={SELECT_CLASS}
          aria-invalid={!!errors.ville}
          {...register("ville")}
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
        {errors.ville ? (
          <p role="alert" className="text-destructive text-xs">
            {errors.ville.message}
          </p>
        ) : null}
      </div>

      <TextField
        name="adresse"
        label="Address"
        register={register}
        error={errors.adresse?.message}
      />
      <TextField
        name="numCin"
        label="CIN number"
        register={register}
        error={errors.numCin?.message}
      />
      <TextField
        name="numIce"
        label="ICE number"
        register={register}
        error={errors.numIce?.message}
      />

      {role === "manager" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="villeSousResponsabilite" className="text-sm font-medium">
            Area of responsibility (optional)
          </label>
          <ManagerAreaMultiSelect
            id="villeSousResponsabilite"
            value={watch("villeSousResponsabilite") ?? ""}
            onChange={(next) =>
              setValue("villeSousResponsabilite", next, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            villes={villes}
            villesResolved={villesQuery.isSuccess}
            aria-invalid={!!errors.villeSousResponsabilite}
          />
          {errors.villeSousResponsabilite ? (
            <p role="alert" className="text-destructive text-xs">
              {errors.villeSousResponsabilite.message}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerId" className="text-sm font-medium">
              Manager (optional)
            </label>
            <select id="managerId" className={SELECT_CLASS} {...register("managerId")}>
              <option value="">No manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={String(manager.id)}>
                  {manager.prenom} {manager.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="villeActuelle" className="text-sm font-medium">
              Current city (optional)
            </label>
            <select
              id="villeActuelle"
              className={SELECT_CLASS}
              aria-invalid={!!errors.villeActuelle}
              {...register("villeActuelle")}
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
            {errors.villeActuelle ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.villeActuelle.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="secteur" className="text-sm font-medium">
              Sector (optional)
            </label>
            <select
              id="secteur"
              className={SELECT_CLASS}
              aria-invalid={!!errors.secteur}
              disabled={!selectedVilleId}
              {...register("secteur")}
            >
              <option value="">
                {selectedVilleId ? "Select a sector" : "Select a city first"}
              </option>
              {secteurs.map((secteur) => (
                <option key={secteur.id} value={secteur.nomSecteur}>
                  {secteur.nomSecteur}
                </option>
              ))}
            </select>
            {errors.secteur ? (
              <p role="alert" className="text-destructive text-xs">
                {errors.secteur.message}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
