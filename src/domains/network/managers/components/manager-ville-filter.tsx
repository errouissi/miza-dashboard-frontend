import { useVilleOptionsQuery } from "@/domains/reference/villes";

/**
 * The city filter — a SELECT, not a text box, and that is forced by the backend.
 *
 * `indexManagers` filters ville with `where('ville', $request->ville)`: EXACT
 * equality, not a partial match. A free-text input over that would return nothing
 * unless the operator guessed the stored spelling character for character, which is
 * a control that appears to work and does not (ADR-0009).
 *
 * Options come from the Villes reference set, read through that domain's sanctioned
 * public surface (FTA §4) exactly as Secteurs does. No ville data is fetched,
 * stored or cached here.
 *
 * IT IS A SEPARATE COMPONENT SO THE QUERY CAN BE CONDITIONAL. `GET /admin/villes`
 * is gated on `access-dashboard` while this page is gated on `view-agents`, so an
 * operator holding only the latter would 403 on the options request. Mounting this
 * component only when the operator may read villes keeps the hook unconditional
 * (rules of hooks) without adding an `enabled` flag to the Villes domain's public
 * API for one caller's benefit.
 *
 * TWO LIMITATIONS, DOCUMENTED RATHER THAN WORKED AROUND:
 *   - `agents.ville` is a free-text COLUMN, not a foreign key to `villes`. A
 *     manager whose ville was typed differently from the reference list cannot be
 *     selected here. The honest fix is a backend distinct-values endpoint; inventing
 *     one would be inventing a contract.
 *   - the options query is bounded at `per_page=100` (BC-H).
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

type ManagerVilleFilterProps = {
  value: string;
  onChange: (ville: string) => void;
};

export function ManagerVilleFilter({ value, onChange }: ManagerVilleFilterProps) {
  const villesQuery = useVilleOptionsQuery();
  const villes = villesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="managerVille" className="text-sm font-medium">
        City
      </label>
      <select
        id="managerVille"
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
