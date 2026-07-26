import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useManagerCommercialsQuery } from "../queries/agent-transfers-queries";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Create Agent Transfer form's Manager + Commercial fields (roadmap M5,
 * Phase 2) — a CASCADING pair, not two independent pickers.
 *
 * OWN COPY, DELIBERATELY NOT SHARED WITH `ReturnManagerCommercialField` —
 * this phase's explicit decision #2: with only two consumers in the
 * roadmap, this pattern does not meet the Rule-of-Three bar for a shared
 * abstraction.
 *
 * GUARANTEES THE BACKEND'S OWN BINDING RULE BY CONSTRUCTION —
 * `StoreAgentTransferRequest::withValidator` requires
 * `commercial.manager_id === manager_id`. Rather than mirroring that check
 * client-side, the Commercial select is POPULATED FROM
 * `GET /admin/agents/{manager}/sub-data` — a read scoped to the CHOSEN
 * manager, so every option offered already belongs to it. A mismatched pair
 * cannot be assembled through this UI.
 *
 * RESETTING THE COMMERCIAL ON A MANAGER CHANGE IS THE CALLER'S JOB, NOT
 * THIS COMPONENT'S — `onManagerChange` is called with the new manager id;
 * the parent page's own handler (`create-agent-transfer-page.tsx`) is
 * responsible for also clearing `commercialId` in that SAME event.
 *
 * COMMERCIAL OPTIONS ARE FILTERED TO `status === "active"` HERE — the
 * sub-data endpoint returns every commercial under the manager regardless
 * of status (`Agent::commercials()` is a plain, unscoped `hasMany`,
 * verified from source); only an active commercial passes
 * `StoreAgentTransferRequest`'s own `exists:...->where('status', 'active')`
 * rule, so offering an inactive one would be a control that appears to
 * work and does not (ADR-0009).
 */
export type TransferManagerCommercialFieldProps = {
  managerId: string;
  commercialId: string;
  onManagerChange: (managerId: string) => void;
  onCommercialChange: (commercialId: string) => void;
  managerError?: string;
  commercialError?: string;
};

export function TransferManagerCommercialField({
  managerId,
  commercialId,
  onManagerChange,
  onCommercialChange,
  managerError,
  commercialError,
}: TransferManagerCommercialFieldProps) {
  const managersQuery = useManagerOptionsQuery();
  const commercialsQuery = useManagerCommercialsQuery(managerId, {
    enabled: !!managerId,
  });

  const activeCommercials = (commercialsQuery.data ?? []).filter(
    (commercial) => commercial.status === "active",
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="transferManagerId" className="text-sm font-medium">
          Manager
        </label>
        <select
          id="transferManagerId"
          aria-invalid={!!managerError}
          className={SELECT_CLASS}
          value={managerId}
          onChange={(event) => onManagerChange(event.target.value)}
        >
          <option value="">Select a manager</option>
          {(managersQuery.data ?? []).map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.prenom} {manager.nom}
            </option>
          ))}
        </select>
        {managerError ? (
          <p role="alert" className="text-destructive text-xs">
            {managerError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="transferCommercialId" className="text-sm font-medium">
          Commercial
        </label>
        <select
          id="transferCommercialId"
          aria-invalid={!!commercialError}
          className={SELECT_CLASS}
          value={commercialId}
          disabled={!managerId}
          onChange={(event) => onCommercialChange(event.target.value)}
        >
          <option value="">
            {managerId ? "Select a commercial" : "Select a manager first"}
          </option>
          {activeCommercials.map((commercial) => (
            <option key={commercial.id} value={commercial.id}>
              {commercial.prenom} {commercial.nom}
            </option>
          ))}
        </select>
        {commercialError ? (
          <p role="alert" className="text-destructive text-xs">
            {commercialError}
          </p>
        ) : null}
      </div>
    </>
  );
}
