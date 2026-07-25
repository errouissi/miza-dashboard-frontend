import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Create Cheque form's Agent field — `agent_id` can be EITHER a manager
 * or a commercial (both share the `agents` table and one `ChequeController`),
 * and no single backend endpoint searches across both roles (verified during
 * M4 discovery, unchanged since Phase 2). Merges Managers' and Commercials'
 * own existing picker exports into one `<select>`, same reasoning as
 * `ChequeAgentFilter` (the list's read-only Agent filter).
 *
 * NOT A REUSE OF `ChequeAgentFilter` ITSELF, deliberately: that component's
 * value semantics are a FILTER's ("" = every agent, a valid, permanent
 * state) — this field's are a CREATE input's ("" = not yet chosen, must
 * resolve to a real id before submit, validated by `createChequeSchema`).
 * The two also differ in label ("Filter by agent" vs "Agent") and wrapper
 * (`FilterField` vs a plain form-field block, not URL-driven). Duplicating
 * the ~15-line merge/sort here — two call sites, not three — follows this
 * codebase's own Rule-of-Three discipline rather than generalizing early.
 *
 * Carries the SAME two disclosed gaps `ChequeAgentFilter` already does, not
 * silently re-derived: the Commercial half is `status=active`-only (M3.5's
 * scoping decision), so a blocked/inactive commercial cannot be selected
 * here even for a legitimate historical submission; the Manager half has no
 * `enabled` gate, so a session holding `create-cheque` without `view-agents`
 * 403s on the Manager half specifically.
 */
export type CreateChequeAgentFieldProps = {
  value: string;
  onChange: (agentId: string) => void;
  /** Gates the Commercials half via `enabled` — see the module docblock. */
  canReadAgents: boolean;
  error?: string;
};

export function CreateChequeAgentField({
  value,
  onChange,
  canReadAgents,
  error,
}: CreateChequeAgentFieldProps) {
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
      <label htmlFor="createChequeAgent" className="text-sm font-medium">
        Agent
      </label>
      <select
        id="createChequeAgent"
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
