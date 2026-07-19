import { isAppError } from "@/infrastructure/errors";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { useToggleClientStatusMutation } from "../queries/clients-queries";
import type { Client } from "../model/client";

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
 *   - `pending` → `toggleStatus()`'s own logic (`status === 'active' ?
 *     'blocked' : 'active'`) sends them to `active` too → labelled
 *     "Activate", the honest description of what pressing it does: approving
 *     a self-registered client. `pending` clients arrive from the public OTP
 *     flow, entirely outside this milestone, but a real operator can
 *     genuinely encounter one here.
 *
 * DELETE IS NOT OFFERED ANYWHERE IN THIS DOMAIN — explicitly out of scope
 * for this milestone. Unlike the Agent domains' BC-R (a "delete" that is
 * really a soft block), `Client::destroy()` is a REAL, permanent row
 * deletion (no `SoftDeletes` trait) — a materially different risk profile
 * this milestone deliberately does not take on.
 */
type ClientStatusDialogProps = {
  /** Absent = closed. Present = confirm the status change on this client. */
  client?: Client;
  onOpenChange: (open: boolean) => void;
};

export function ClientStatusDialog({ client, onOpenChange }: ClientStatusDialogProps) {
  const toggleMutation = useToggleClientStatusMutation();

  // The only two outcomes toggleStatus() can produce, mirrored exactly:
  // anything other than "active" flips to "active"; "active" flips to "blocked".
  const willActivate = client ? client.status !== "active" : false;

  const onConfirm = () => {
    if (!client) return;
    toggleMutation.mutate(client.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ConfirmActionDialog
      open={client !== undefined}
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
