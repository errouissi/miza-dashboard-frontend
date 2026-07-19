import { useVilleOptionsQuery } from "@/domains/reference/villes";

/**
 * The current-city filter — a SELECT, not a text box, for the same reason as
 * Managers' city filter. `indexCommercials` filters `ville_actuelle` with
 * exact equality (`where('ville_actuelle', $request->ville_actuelle)`); a
 * free-text input over that would return nothing unless the operator guessed
 * the stored spelling exactly (ADR-0009).
 *
 * Options come from the Villes reference set, read through its public surface
 * (FTA §4), exactly as Managers' city filter does. No ville data is fetched,
 * stored or cached here.
 *
 * IT IS A SEPARATE COMPONENT SO THE QUERY CAN BE CONDITIONAL. `GET
 * /admin/villes` is gated on `access-dashboard` while this page is gated on
 * `view-agents`, so an operator holding only the latter would 403 on the
 * options request. Mounting this component only when the operator may read
 * villes keeps the hook unconditional (rules of hooks).
 *
 * TWO LIMITATIONS, DOCUMENTED RATHER THAN WORKED AROUND (same as Managers'
 * BC-S, a second instance of the same class):
 *   - `agents.ville_actuelle` is a free-text COLUMN, not a foreign key to
 *     `villes`. A commercial whose current city was typed differently from
 *     the reference list cannot be selected here.
 *   - the options query is bounded at `per_page=100` (BC-H).
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

type CommercialVilleFilterProps = {
  value: string;
  onChange: (villeActuelle: string) => void;
};

export function CommercialVilleFilter({ value, onChange }: CommercialVilleFilterProps) {
  const villesQuery = useVilleOptionsQuery();
  const villes = villesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="commercialVille" className="text-sm font-medium">
        Current city
      </label>
      <select
        id="commercialVille"
        aria-label="Filter by current city"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All cities</option>
        {villes.map((ville) => (
          <option key={ville.id} value={ville.nomVille}>
            {ville.nomVille}
          </option>
        ))}
      </select>
    </div>
  );
}
