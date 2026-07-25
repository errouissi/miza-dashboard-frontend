import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";
import { FilterField } from "@/shared/components/business/filter-bar";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Deposits list's Agent filter — a deposit's `agent_id` can be EITHER a
 * manager or a commercial, same fact as Cheques'. Domain-local, NOT a
 * reuse of `ChequeAgentFilter` (a cross-domain import from `money/cheques`
 * into `money/deposits`) — each resource keeps its own agent filter, the
 * same "duplication retained by decision" precedent Cheques' own filter
 * already established for this exact merge. The ~15-line merge/sort is
 * genuinely identical to `ChequeAgentFilter`'s; that duplication is the
 * cheaper mistake (ADR-0012), not a shared component to extract on a
 * second instance alone.
 *
 * Same known, disclosed gap as `ChequeAgentFilter`: `useCommercialOptionsQuery`
 * is scoped `status=active` only (M3.5's own decision); a blocked/inactive
 * commercial's historical deposits remain visible in the unfiltered list
 * but cannot be found through this filter.
 */
export type DepositAgentFilterProps = {
  value: string;
  onChange: (agentId: string) => void;
  /** Gates the Commercials half via `enabled` — see the module docblock. */
  canReadAgents: boolean;
};

export function DepositAgentFilter({
  value,
  onChange,
  canReadAgents,
}: DepositAgentFilterProps) {
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
    <FilterField label="Agent" htmlFor="depositAgent">
      <select
        id="depositAgent"
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
