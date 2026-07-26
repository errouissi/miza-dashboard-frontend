import { useState } from "react";
import { isAppError } from "@/infrastructure/errors";
import { useFreshConfirm } from "@/shared/hooks";
import { ConfirmActionDialog } from "@/shared/components/patterns/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  useApproveChequeMutation,
  useChequeFreshnessQuery,
} from "../queries/cheques-queries";
import type { Cheque, ChequeAllocationType } from "../model/cheque";

/**
 * Confirmation before approving a cheque, WITH an allocation split (M4.2
 * Phase 3C, scope corrected after re-verifying the backend contract).
 *
 * BACKEND CONTRACT RE-VERIFIED FROM SOURCE (`ChequeController::approve`'s
 * own validator), not assumed from the earlier "simple confirm" pass:
 *   `allocations`          => sometimes|array|min:1|max:2
 *   `allocations.*.type`   => required_with:allocations|in:rapped,grattage
 *   `allocations.*.amount` => required_with:allocations|numeric|min:0.01|decimal:0,2
 *   (approve() itself, after validation) sum of allocations MUST
 *   `bccomp`-equal the cheque amount exactly; each type at most once.
 *
 * `min:0.01` on `allocations.*.amount` is the load-bearing fact: a
 * ZERO-VALUE entry is REJECTED by the backend (a 422), not merely
 * redundant. So a 100%-rapped split is NOT `[{rapped, amount},{grattage,
 * amount:0}]` — it is `[{rapped, amount}]`, the zero side OMITTED
 * entirely. `buildAllocations` below only ever includes a side whose
 * amount is `> 0`.
 *
 * ONLY TWO PLAIN INPUTS, NO DYNAMIC ROWS — confirmed scope. The cheque
 * amount itself is read-only (never an input the operator can edit; it is
 * the record being approved, not a value being entered).
 *
 * VALIDATION IS CENTS-SAFE, NOT FLOATING-POINT: `cheque.amount` is a
 * `decimal:2`-cast STRING (see `model/cheque.ts`'s own docblock — never to
 * be parsed into a `number` for DISPLAY). Comparing it against operator
 * input is a different case — an actual arithmetic check the backend
 * itself does with `bcadd`/`bccomp` (exact decimal arithmetic). `toCents`
 * mirrors that exactness by converting every amount to an integer number
 * of cents before summing/comparing, the same way the backend avoids
 * binary floating point.
 *
 * `confirmDisabled` (`ConfirmActionDialog`'s new, generic prop) carries
 * this dialog's own validity — the backend's `min:0.01` per-side and
 * "sum must equal the cheque amount exactly" rules mirrored client-side so
 * an invalid split cannot even be submitted, not just rejected after a
 * round trip.
 *
 * FRESHNESS RULE (M4 · G4 closure, FTA §8) — THE ONE DIALOG WHERE STALENESS
 * IS ABOUT MORE THAN STATUS: the split is SEEDED from `cheque.amount` the
 * moment this dialog opens (100% rapped, matching the legacy default), and
 * the backend's own rule requires the submitted sum to equal the cheque's
 * amount EXACTLY. If the amount was corrected underneath the operator, the
 * seeded split silently no longer sums to the real amount — exactly the
 * scenario FTA §8 names verbatim ("someone else approved it; the amount
 * was corrected"). `hasChanged` therefore checks BOTH `status` and
 * `amount`, not status alone. On staleness, this dialog does NOT attempt a
 * live re-seed in place — it blocks confirm and asks the operator to close
 * and reopen, which naturally re-triggers the EXISTING re-seed-on-reopen
 * mechanism below (`setSeededChequeId(undefined)`) against whatever the
 * cheque now holds. `useChequeFreshnessQuery` uses its OWN cache key,
 * deliberately distinct from `useChequeQuery`'s — see that hook's own
 * docblock for why sharing the key would let a transient verification
 * failure corrupt the host page's own display.
 */
type ApproveChequeDialogProps = {
  /** Absent = closed. Present = confirm approving this cheque. */
  cheque?: Cheque;
  onOpenChange: (open: boolean) => void;
};

/** Parses a decimal(10,2)-safe amount string into integer CENTS, or `null` if not a valid non-negative amount with at most 2 decimal places. */
function toCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Omits whichever side is zero — the backend's own `min:0.01` per-entry rule rejects a zero-value allocation outright. */
function buildAllocations(
  rappedCents: number,
  grattageCents: number,
): { type: ChequeAllocationType; amount: number }[] {
  const allocations: { type: ChequeAllocationType; amount: number }[] = [];
  if (rappedCents > 0) allocations.push({ type: "rapped", amount: rappedCents / 100 });
  if (grattageCents > 0)
    allocations.push({ type: "grattage", amount: grattageCents / 100 });
  return allocations;
}

export function ApproveChequeDialog({ cheque, onOpenChange }: ApproveChequeDialogProps) {
  const [rapped, setRapped] = useState("");
  const [grattage, setGrattage] = useState("0");
  // Tracks which cheque the two fields above were last seeded for — an
  // "adjust state during render" reset (React's own recommended pattern for
  // this exact case), not an effect: `cheque` is a PROP that toggles
  // undefined/object on the same mounted dialog instance (the parent does
  // not remount it per cheque), so there is no render commit where a
  // `useEffect` could run before the stale values would flash on screen.
  const [seededChequeId, setSeededChequeId] = useState<number | undefined>(undefined);
  const approveMutation = useApproveChequeMutation();

  const freshnessQuery = useChequeFreshnessQuery(cheque?.id ?? -1);
  const freshness = useFreshConfirm({
    open: cheque !== undefined,
    current: cheque,
    query: freshnessQuery,
    hasChanged: (fresh, snapshot) =>
      fresh.status !== "en_attente" || fresh.amount !== snapshot.amount,
  });

  // Re-seeds whenever a DIFFERENT cheque opens. Defaults to the backend's
  // own legacy shape (100% rapped) so an operator who touches nothing gets
  // exactly the same outcome the old "no allocations" call used to produce.
  if (cheque && cheque.id !== seededChequeId) {
    setSeededChequeId(cheque.id);
    setRapped(cheque.amount);
    setGrattage("0");
  }

  const rappedCents = toCents(rapped);
  const grattageCents = toCents(grattage);
  const chequeCents = cheque ? toCents(cheque.amount) : null;

  const bothValid = rappedCents !== null && grattageCents !== null;
  const sumMatches =
    bothValid && chequeCents !== null && rappedCents + grattageCents === chequeCents;

  const validationMessage = !bothValid
    ? "Enter a valid, non-negative amount for both fields."
    : !sumMatches
      ? "Rapped and grattage must add up exactly to the cheque amount."
      : undefined;

  const onConfirm = () => {
    if (
      !cheque ||
      rappedCents === null ||
      grattageCents === null ||
      !sumMatches ||
      freshness.blocked
    )
      return;
    approveMutation.mutate(
      { id: cheque.id, allocations: buildAllocations(rappedCents, grattageCents) },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const freshnessMessage = freshness.isStale
    ? "This cheque changed while you were reviewing it. Close and reopen to approve the current version."
    : freshness.isUnavailable
      ? "This cheque's current status could not be verified."
      : undefined;

  const errorMessage =
    freshnessMessage ??
    (isAppError(approveMutation.error)
      ? approveMutation.error.kind === "permission"
        ? "You do not have permission to approve this cheque."
        : "This cheque could not be approved. It may already have been processed."
      : undefined);

  return (
    <ConfirmActionDialog
      open={cheque !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          approveMutation.reset();
          // Forces a re-seed on the NEXT open, even for the same cheque —
          // otherwise a dismissed, half-edited split would still be sitting
          // in state (the render-time reset above only fires on an ID
          // CHANGE, not a re-open of the same one), the same
          // dismiss-clears-state precedent `RejectChequeDialog`'s own
          // `reason` already established.
          setSeededChequeId(undefined);
        }
        onOpenChange(open);
      }}
      title="Approve cheque"
      description={
        cheque
          ? `Approve cheque "${cheque.numCheque}"? Split the amount between rapped (cash-like) and grattage (stock allocation only).`
          : null
      }
      confirmLabel="Approve"
      pendingLabel="Approving…"
      onConfirm={onConfirm}
      isPending={approveMutation.isPending}
      errorMessage={errorMessage}
      variant="default"
      confirmDisabled={!sumMatches || freshness.blocked}
    >
      {freshness.isChecking ? (
        <p className="text-muted-foreground text-sm">Checking for changes…</p>
      ) : null}
      {freshness.isUnavailable ? (
        <Button type="button" variant="outline" size="sm" onClick={freshness.retry}>
          Retry
        </Button>
      ) : null}
      {cheque ? (
        <>
          <div>
            <span className="text-sm font-medium">Cheque amount</span>
            <p className="text-sm">{cheque.amount} DH</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="approveRappedAmount" className="text-sm font-medium">
              Rapped
            </label>
            <Input
              id="approveRappedAmount"
              inputMode="decimal"
              value={rapped}
              onChange={(event) => setRapped(event.target.value)}
              aria-invalid={!!validationMessage}
              disabled={approveMutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="approveGrattageAmount" className="text-sm font-medium">
              Grattage
            </label>
            <Input
              id="approveGrattageAmount"
              inputMode="decimal"
              value={grattage}
              onChange={(event) => setGrattage(event.target.value)}
              aria-invalid={!!validationMessage}
              disabled={approveMutation.isPending}
            />
          </div>
          {validationMessage ? (
            <p role="alert" className="text-destructive text-xs">
              {validationMessage}
            </p>
          ) : null}
        </>
      ) : null}
    </ConfirmActionDialog>
  );
}
