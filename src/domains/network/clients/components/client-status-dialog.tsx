import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useToggleClientStatusMutation } from "../queries/clients-queries";
import type { ClientStatus } from "../model/client";

/**
 * Confirmation before changing a client's status.
 *
 * ONE ACTION, NOT TWO — a genuine structural difference from every Agent
 * domain's status dialog, not a simplification of it. Managers/Commercials
 * have separate `block`/`activate` endpoints specifically because their
 * shared `toggle-status` endpoint cannot express their third status
 * (`inactive`), so they avoid it. Clients have **no such alternative**:
 * `PATCH /clients/{id}/status` → `Client::toggleStatus()` is the ONLY
 * status-changing endpoint that exists, gated by the single
 * `manage-client-status` permission. There is nothing to prefer over it.
 *
 * THE LABEL IS COMPUTED FROM THE CLIENT'S CURRENT STATUS, not from a caller
 * prop the way `ManagerStatusDialog`/`CommercialStatusDialog` take an
 * `action` — there is only one action, and what it is called depends on
 * where the client currently stands:
 *   - `active`  → the toggle blocks them  → labelled "Block"
 *   - `blocked` → the toggle activates them → labelled "Activate"
 *   - `pending` → NO ACTION. Fixed M7 Phase 1 (Client 360 discovery,
 *     re-verified fresh from source): `toggleStatus()`'s OWN CONTROLLER
 *     CODE refuses a pending client outright —
 *     `if ($client->isPending()) return 400 'Cannot toggle status for
 *     pending clients'` — it never reaches the `status === 'active' ?
 *     'blocked' : 'active'` flip this docblock previously (incorrectly)
 *     described as sending a pending client to `active`. `pending` clients
 *     arrive from the public OTP flow, entirely outside this milestone, and
 *     have no manual activation path today — see the Client 360 discovery
 *     follow-up (`docs/next-session.md`) for the backend gap this leaves.
 *     Every caller (`clients-list-page.tsx`, `client-workspace-page.tsx`)
 *     must never offer this action for a pending client; `open` below is a
 *     second, defensive guard against ever confirming a call the backend
 *     will reject.
 *
 * DELETE IS NOT OFFERED ANYWHERE IN THIS DOMAIN — explicitly out of scope
 * for this milestone. Unlike the Agent domains' BC-R (a "delete" that is
 * really a soft block), `Client::destroy()` is a REAL, permanent row
 * deletion (no `SoftDeletes` trait) — a materially different risk profile
 * this milestone deliberately does not take on.
 */
/**
 * Structural, not `Client` (the list row) — reused verbatim by the Client
 * 360 workspace (M7 Phase 1), whose own `ClientDetail` model carries the
 * same three fields under the same names. Only what this dialog actually
 * reads (ADR-0008's own discipline, applied to a shared component's prop
 * instead of a wire mapper).
 */
type StatusDialogClient = {
  id: number;
  phone: string;
  status: ClientStatus;
};

type ClientStatusDialogProps = {
  /** Absent = closed. Present = confirm the status change on this client. */
  client?: StatusDialogClient;
  onOpenChange: (open: boolean) => void;
};

export function ClientStatusDialog({ client, onOpenChange }: ClientStatusDialogProps) {
  const toggleMutation = useToggleClientStatusMutation();

  // A pending client has no valid action here — see the module docblock.
  // Every caller must already withhold the button that would open this
  // dialog for one; this is the defensive second guard.
  const isPending = client?.status === "pending";

  // The only two outcomes toggleStatus() can produce, mirrored exactly:
  // anything other than "active" flips to "active"; "active" flips to "blocked".
  const willActivate = client ? client.status !== "active" : false;

  const onConfirm = () => {
    if (!client || isPending) return;
    toggleMutation.mutate(client.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ConfirmActionDialog
      open={client !== undefined && !isPending}
      onOpenChange={(open) => {
        if (!open) toggleMutation.reset();
        onOpenChange(open);
      }}
      title={willActivate ? "Activate client" : "Block client"}
      description={
        client
          ? willActivate
            ? `Activate “${client.phone}”? They will be able to sign in again.`
            : `Block “${client.phone}”? They will not be able to sign in until reactivated.`
          : null
      }
      confirmLabel={willActivate ? "Activate" : "Block"}
      pendingLabel={willActivate ? "Activating…" : "Blocking…"}
      onConfirm={onConfirm}
      isPending={toggleMutation.isPending}
      errorMessage={
        isAppError(toggleMutation.error)
          ? "This account's status could not be changed."
          : undefined
      }
    />
  );
}
