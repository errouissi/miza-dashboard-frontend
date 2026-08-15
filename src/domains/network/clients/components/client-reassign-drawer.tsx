import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { useCommercialOptionsQuery } from "@/domains/network/commercials";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import { useReassignClientMutation } from "../queries/clients-queries";
import type { ClientDetailCommercial } from "../model/client";

/**
 * Client 360 Phase 2 — the single-Client ownership action drawer.
 *
 * ONE ENDPOINT, ONE UI ACTION, TWO LABELS — `PATCH /admin/clients/{id}/assign`
 * (`useReassignClientMutation` → `reassignClient`) works identically whether
 * the Client starts unassigned or already assigned (verified from source,
 * `ClientAssignmentService::reassignTo()` has no branch on the prior value —
 * see `ReassignClientInput`'s own docblock in `model/client.ts`), so this is
 * NOT a fork between an "Assign" drawer and a "Reassign" drawer. The title/
 * submit copy is computed from `client.commercial === null`, mirroring
 * `ClientStatusDialog`'s own "one action, label from current state"
 * convention already established in this domain.
 *
 * DELIBERATELY NOT `POST /admin/clients/{id}/assign` (`assignToAgent`) —
 * that endpoint also overwrites `ville`/`secteur` from the target
 * Commercial, a client-city-mutating side effect this workspace's own
 * Reassign action must never trigger. The copy below states this plainly,
 * reusing `client-bulk-assign-sheet.tsx`'s own established wording, not
 * inventing new copy for the same fact.
 *
 * SAME-TARGET IS A SILENT NO-OP, NOT A REQUEST — the backend genuinely
 * accepts a same-Commercial reassignment (200, no history row written —
 * `ClientAssignmentService::appendHistoryIfChanged` skips it), but there is
 * no reason to round-trip a mutation whose only effect is a wasted request.
 * `onSubmit` compares the selection against `client.commercial.id` BEFORE
 * calling the mutation and simply closes the drawer when they match — this
 * is NOT an error state, so no message is shown for it. KEPT even after
 * `submitDisabled` (below) was added — a disabled button only blocks the
 * click path; Enter-key/programmatic submission still reaches `onSubmit`.
 *
 * `submitDisabled` (M7 Client 360 manual-QA fix) — Reassign is disabled
 * for as long as `selectedAgentId === client.commercial?.id`, which is
 * true the instant the drawer opens (seeded to the current Commercial, see
 * below). A silent no-op close on Submit was correct but gave no signal
 * that the click did nothing; disabling the button up front makes that
 * state visible instead of surprising. `FormDrawer`'s own `submitDisabled`
 * prop (new, optional, defaults `false`) carries this — no other caller of
 * that shared shell is affected.
 *
 * PERMISSIONS ARE INDEPENDENT (Phase 2 discovery, §3): `assign-client` gates
 * whether this drawer is ever opened at all (the caller's job — see
 * `ClientCommercialSection`); `view-agents` gates ONLY the Commercial
 * picker, checked here. Without `view-agents`, `useCommercialOptionsQuery`
 * is never called (`enabled: canViewAgents` — no unauthorized request), and
 * the `<select>` renders disabled with an explanatory placeholder rather
 * than a silently-empty or broken one — the same "fail closed, explain why"
 * discipline the wizard's own city-scoped Sector select already established
 * for "no city selected yet."
 *
 * ERROR HANDLING: the business-rule 422
 * ("agent_id must reference an active commercial") carries no `errors` key
 * and no `code` (BC-X-class gap, re-verified fresh for this endpoint during
 * Phase 2 discovery) — normalizes to `kind: "unknown"`, handled by the SAME
 * generic-failure branch `client-bulk-assign-sheet.tsx` already uses, never
 * matched by the backend's message string. The drawer stays open on any
 * failure (`FormDrawer`'s own default — no `onOpenChange(false)` in the
 * mutation's `onError`).
 *
 * DOES NOT DEPEND ON THE MUTATION'S OWN SUCCESS RESPONSE for display
 * identity — `reassignClient`'s response is narrow (`{id, agent_id}` only,
 * no nested Commercial). `useReassignClientMutation`'s own invalidation of
 * `clientsKeys.detail(id)` is what the workspace's relationship section
 * re-reads afterward.
 */
const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const reassignSchema = z.object({
  agentId: z.string().trim().min(1, "Select a commercial."),
});

type FormValues = z.infer<typeof reassignSchema>;

/** Structural, mirroring `ClientFormSheet`'s own `EditableClient` discipline — only what this drawer actually reads. */
type ReassignableClient = {
  id: number;
  commercial: ClientDetailCommercial | null;
};

type ClientReassignDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client being (re)assigned. Absent = the drawer is closed. */
  client?: ReassignableClient;
};

export function ClientReassignDrawer({
  open,
  onOpenChange,
  client,
}: ClientReassignDrawerProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(reassignSchema),
    defaultValues: { agentId: "" },
  });

  const reassignMutation = useReassignClientMutation();

  const { has } = usePermission();
  const canViewAgents = has(PERMISSIONS.VIEW_AGENTS);
  const commercialsQuery = useCommercialOptionsQuery({ enabled: canViewAgents });
  const commercials = commercialsQuery.data ?? [];

  const hasCurrentCommercial = client !== undefined && client.commercial !== null;

  // Re-seed on open, or reassigning one client straight after another shows
  // the previous row's selection or a stale error.
  useEffect(() => {
    if (open && client) {
      form.reset({ agentId: client.commercial ? String(client.commercial.id) : "" });
      reassignMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  // Drives `submitDisabled` below — re-renders on every selection change,
  // same `form.watch()` pattern `TransferManagerCommercialField`'s own
  // caller already uses for a cascading field.
  const selectedAgentId = form.watch("agentId");
  const isSameTarget =
    client?.commercial !== undefined &&
    client.commercial !== null &&
    String(client.commercial.id) === selectedAgentId;

  const onSubmit = form.handleSubmit((values) => {
    if (!client) return;
    const selectedId = Number(values.agentId);

    // Same-target: a genuine backend no-op (200, no history row). Skip the
    // request — this is not an error, just nothing to do. KEPT as
    // defense-in-depth even though `submitDisabled` below already prevents
    // this in the normal click path — Enter-key/programmatic submission
    // bypasses a disabled button, not this handler.
    if (client.commercial && client.commercial.id === selectedId) {
      onOpenChange(false);
      return;
    }

    reassignMutation.mutate(
      { id: client.id, agentId: selectedId },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  // Field-level 422s map to `agent_id`; the code-less business-rule 422
  // (kind "unknown") falls through to the generic banner below, exactly
  // like `client-bulk-assign-sheet.tsx`'s own handling of the same gap.
  const error = reassignMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(error) ? error.fieldErrors?.[wireName]?.[0] : undefined;

  const agentIdError = fieldError("agent_id");
  const hasFieldError = !!agentIdError;

  const generalError =
    isAppError(error) && !hasFieldError
      ? error.kind === "permission"
        ? "You do not have permission to assign this client."
        : "This assignment could not be completed. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={hasCurrentCommercial ? "Reassign Commercial" : "Assign Commercial"}
      description={
        <>
          Only the assigned commercial changes — this client&rsquo;s city and sector are
          left exactly as they are.
        </>
      }
      onSubmit={onSubmit}
      isPending={reassignMutation.isPending}
      errorMessage={generalError}
      submitLabel={hasCurrentCommercial ? "Reassign" : "Assign"}
      pendingLabel={hasCurrentCommercial ? "Reassigning…" : "Assigning…"}
      submitDisabled={isSameTarget}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reassignAgent" className="text-sm font-medium">
          Commercial
        </label>
        <select
          id="reassignAgent"
          aria-invalid={!!form.formState.errors.agentId || !!agentIdError}
          className={SELECT_CLASS}
          disabled={!canViewAgents}
          {...form.register("agentId")}
        >
          <option value="">
            {canViewAgents ? "Select a commercial" : "Commercial list unavailable"}
          </option>
          {commercials.map((commercial) => (
            <option key={commercial.id} value={String(commercial.id)}>
              {commercial.prenom} {commercial.nom}
            </option>
          ))}
        </select>
        {!canViewAgents ? (
          <p className="text-muted-foreground text-xs">
            You do not have permission to view the commercial list.
          </p>
        ) : null}
        {form.formState.errors.agentId ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.agentId.message}
          </p>
        ) : null}
        {agentIdError ? <p className="text-destructive text-xs">{agentIdError}</p> : null}
      </div>
    </FormDrawer>
  );
}
