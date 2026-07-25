import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";
import { FilterField } from "@/shared/components/business/filter-bar";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Cheques list's Agent filter — a cheque's `agent_id` can be EITHER a
 * manager or a commercial (both share the `agents` table and one
 * `ChequeController`), and no single backend endpoint searches across both
 * roles (verified during M4 discovery: `GET /admin/agents/managers` and
 * `/commercials` are separate, each independently bounded at `per_page=100`,
 * BC-H). Design System §12 requires a resolved-name picker for any foreign
 * key, never raw ID entry — so this merges Managers' and Commercials' own
 * existing picker exports into one `<select>`, reusing both unchanged,
 * rather than inventing a new cross-role search endpoint or falling back to
 * a bare numeric input.
 *
 * A KNOWN, DISCLOSED GAP, not silently worked around: `useCommercialOptionsQuery`
 * is scoped `status=active` only (M3.5's own decision, for bulk-assign's
 * business rule that a client cannot be assigned to an inactive commercial —
 * a rule that does not apply here). A blocked or inactive commercial's
 * historical cheques exist and remain visible in the unfiltered list, but
 * cannot be found through THIS filter. Extending the picker with a status
 * param (or adding an unbounded variant) is a real follow-up, not fixed
 * here — flagged, not guessed around.
 *
 * `useManagerOptionsQuery` has no `enabled` gate (the same known, accepted
 * gap M3.6's wizard already disclosed for the identical reason: its only
 * prior callers all shared `view-agents` with the endpoint it reads). This
 * filter is gated on `view-cheques`/`view-agents` differing in exactly the
 * same way — a session holding `view-cheques` without `view-agents` would
 * 403 on the Manager half of this picker specifically. Not fixed here:
 * modifying Managers' public surface is out of this domain's scope.
 */
export type ChequeAgentFilterProps = {
  value: string;
  onChange: (agentId: string) => void;
  /** Gates the Commercials half via `enabled` — see the module docblock. */
  canReadAgents: boolean;
};

export function ChequeAgentFilter({
  value,
  onChange,
  canReadAgents,
}: ChequeAgentFilterProps) {
  const managersQuery = useManagerOptionsQuery();
  const commercialsQuery = useCommercialOptionsQuery({ enabled: canReadAgents });

  const options = [
    ...(managersQuery.data ?? []).map((manager) => ({
      id: manager.id,
      name: `${manager.prenom} ${manager.nom}`,
    })),
    ...(commercialsQuery.data ?? []).map((commercial) => ({
      id: commercial.id,
      name: `${commercial.prenom} ${commercial.nom}`,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FilterField label="Agent" htmlFor="chequeAgent">
      <select
        id="chequeAgent"
        aria-label="Filter by agent"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All agents</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </FilterField>
  );
}
