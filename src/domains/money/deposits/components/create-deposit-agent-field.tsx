import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Create Deposit form's Agent field (M4.3 Phase 4) — `agent_id` can be
 * EITHER a manager or a commercial (both share the `agents` table and one
 * `DepoController`), the same fact `CreateChequeAgentField` already
 * documents for Cheques. Merges Managers' and Commercials' own existing
 * picker exports into one `<select>`.
 *
 * NOT A REUSE OF `DepositAgentFilter` ITSELF, deliberately — same reasoning
 * `CreateChequeAgentField`'s own docblock gives for its Cheques equivalent:
 * a FILTER's value semantics ("" = every agent, a valid, permanent state)
 * differ from a CREATE input's ("" = not yet chosen, must resolve to a real
 * id before submit). Duplicating the merge here is the SECOND occurrence of
 * this exact pattern (Cheques' own field is the first) — still below this
 * codebase's Rule-of-Three bar for extracting a shared component.
 *
 * Carries the same two disclosed gaps `CreateChequeAgentField`/
 * `DepositAgentFilter` already do: the Commercial half is `status=active`
 * only; the Manager half has no `enabled` gate, so a session holding
 * `create-depo` without `view-agents` 403s on the Manager half specifically.
 */
export type CreateDepositAgentFieldProps = {
  value: string;
  onChange: (agentId: string) => void;
  /** Gates the Commercials half via `enabled` — see the module docblock. */
  canReadAgents: boolean;
  error?: string;
};

export function CreateDepositAgentField({
  value,
  onChange,
  canReadAgents,
  error,
}: CreateDepositAgentFieldProps) {
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor="createDepositAgent" className="text-sm font-medium">
        Agent
      </label>
      <select
        id="createDepositAgent"
        aria-invalid={!!error}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select an agent</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
