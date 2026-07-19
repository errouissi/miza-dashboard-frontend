import { useManagerOptionsQuery } from "@/domains/network/managers";

/**
 * The manager filter — a SELECT, sourced from the real backend endpoint
 * (`GET /admin/agents/managers`), read through Managers' public surface
 * (FTA §4) exactly as the city filters read Villes'.
 *
 * `indexCommercials` filters `manager_id` with exact equality
 * (`where('manager_id', $request->manager_id)`), and `manager_id` IS a real
 * foreign key (`agents.manager_id`, `constrained('agents')`) — unlike `ville`/
 * `ville_actuelle`/`secteur`, this one has no BC-S-class mismatch risk: every
 * value offered here is a real, selectable manager id.
 *
 * NOT GATED ON A SEPARATE PERMISSION, unlike the city filter. `GET
 * /admin/agents/managers` and `GET /admin/agents/commercials` (this page's own
 * route) are BOTH gated on `view-agents` — the same string — so an operator
 * who can reach this page can always resolve this query. No conditional mount
 * is needed here (verified from `routes/api.php`, not assumed from the city
 * filter's precedent).
 *
 * BC-H applies: the options source is bounded at `per_page=100`. Only one
 * manager exists in the dev database at the time of writing, so this is real
 * but currently invisible — it will bite the day a 101st manager is created.
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

type CommercialManagerFilterProps = {
  value: string;
  onChange: (managerId: string) => void;
};

export function CommercialManagerFilter({
  value,
  onChange,
}: CommercialManagerFilterProps) {
  const managersQuery = useManagerOptionsQuery();
  const managers = managersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="commercialManager" className="text-sm font-medium">
        Manager
      </label>
      <select
        id="commercialManager"
        aria-label="Filter by manager"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All managers</option>
        {managers.map((manager) => (
          <option key={manager.id} value={String(manager.id)}>
            {manager.prenom} {manager.nom}
          </option>
        ))}
      </select>
    </div>
  );
}
