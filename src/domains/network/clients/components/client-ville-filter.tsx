import { useVilleOptionsQuery } from "@/domains/reference/villes";

/**
 * The city filter — a SELECT, not a text box, for the same reason as the
 * Agent domains' city filters. `ClientController::index` filters `ville`
 * with exact equality (`scopeByVille`: `where('ville', $ville)`); a
 * free-text input over that would return nothing unless the operator
 * guessed the stored spelling exactly (ADR-0009).
 *
 * Options come from the Villes reference set, read through its public
 * surface (FTA §4), exactly as Managers'/Commercials' city filters do. No
 * ville data is fetched, stored or cached here.
 *
 * IT IS A SEPARATE COMPONENT SO THE QUERY CAN BE CONDITIONAL. `GET
 * /admin/villes` is gated on `access-dashboard` while this page is gated on
 * `view-clients`, so an operator holding only the latter would 403 on the
 * options request. Mounting this component only when the operator may read
 * villes keeps the hook unconditional (rules of hooks).
 *
 * TWO LIMITATIONS, DOCUMENTED RATHER THAN WORKED AROUND (the same BC-S/BC-H
 * classes already carried by Managers/Commercials, new instances):
 *   - `clients.ville` is a free-text COLUMN, not a foreign key to `villes`.
 *     A client whose city was typed differently from the reference list
 *     cannot be selected here.
 *   - the options query is bounded at `per_page=100` (BC-H).
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

type ClientVilleFilterProps = {
  value: string;
  onChange: (ville: string) => void;
};

export function ClientVilleFilter({ value, onChange }: ClientVilleFilterProps) {
  const villesQuery = useVilleOptionsQuery();
  const villes = villesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="clientVille" className="text-sm font-medium">
        City
      </label>
      <select
        id="clientVille"
        aria-label="Filter by city"
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
