import { useEffect, useRef, useState } from "react";

/**
 * The FTA §8 "freshness rule", as a shared mechanism (M4 · G4 closure).
 *
 * "MUST: data that gates an irreversible action is refetched immediately
 * before that action is confirmed, and the confirmation dialog renders from
 * that fresh read... If the refetch reveals the record changed underneath
 * them, the dialog MUST say so and refuse the action rather than submitting
 * against a version the operator never saw."
 *
 * EXTRACTED NOW, AT TWO DOMAINS (Cheques, Deposits), NOT DEFERRED TO A
 * THIRD — this is the same category of decision `invalidation-map.ts`
 * already made at M4.1 (shipped with zero callers): a cross-cutting policy
 * a frozen document MANDATES uniformly, not a UI shape discovered by
 * repetition. CLAUDE.md's Rule-of-Three governs speculative abstractions;
 * this one is mandated and already has five concrete call sites.
 *
 * PRESENTATION-ADJACENT, NOT PRESENTATION-ONLY — and that is why this lives
 * in `shared/hooks/`, not `shared/components/`: `ConfirmActionDialog` stays
 * exactly what its own docblock says it is (owns no mutation, no query
 * client, no domain type). This hook owns none of THAT either — no query
 * key, no fetch function, no domain type of its own. It owns only the
 * STATE MACHINE ("checking / stale / unavailable / settled"), driven by a
 * caller-supplied `query` (structurally typed — no `@tanstack/react-query`
 * import here, so this file stays framework-boundary-clean the same way
 * `infrastructure/` does) and a caller-supplied `hasChanged` predicate
 * (domain knowledge: what counts as "changed" for a Cheque is not the same
 * question for a Deposit). No copy is owned here either — every message a
 * dialog shows is the caller's own, mirroring `errorMessage`'s existing
 * boundary on `ConfirmActionDialog`.
 *
 * HOW STALENESS IS ACTUALLY DETECTED: `query.refetch()` is called
 * EXPLICITLY the instant `open` becomes true — not left to `staleTime`'s
 * passive "refetch on mount if stale" behaviour, which would leave a
 * one-render race window where `isFetching` has not yet flipped true. An
 * explicit `refetch()` call, awaited directly, removes that race and gives
 * a deterministic signal: the PROMISE it returns resolves to the exact
 * settled result, compared against a SNAPSHOT frozen the instant `open`
 * flipped true (via the render-time-adjustment pattern
 * `ApproveChequeDialog` already established for its own prop-driven reset —
 * not a `useEffect`, since freezing a value from THIS render is not
 * synchronizing with an external system). The actual network call IS a
 * "synchronize with an external system" side effect, so it is the one part
 * of this hook that runs inside `useEffect`.
 *
 * NO OPTIMISTIC UPDATE, NOTHING WRITTEN TO THE CACHE HERE — this hook only
 * READS, via a query the caller supplies. THE CALLER'S QUERY MUST USE ITS
 * OWN, DISTINCT CACHE KEY — deliberately NOT the same key as the host
 * page's own detail query. TanStack Query's error/success state is tracked
 * per query key, shared across every observer of it; sharing the detail
 * key would mean a TRANSIENT FAILURE of this pre-confirm check flips the
 * host page's own display into an error state too (confirmed empirically
 * while building the Cheques/Deposits callers — see each domain's own
 * `*FreshnessQuery` docblock). This hook's own "renders from that fresh
 * read" guarantee is therefore scoped to the DIALOG ITSELF: when the fresh
 * read differs from the snapshot, confirm is blocked and the caller's own
 * `isStale` copy explains it — the host page's display is untouched by
 * either outcome, and picks up the true state on its own next natural
 * refetch (a subsequent mutation's invalidation, a window refocus, or the
 * operator reopening the dialog).
 *
 * ON A FAILED VERIFICATION (network/server failure after the query's own
 * retries): BLOCKS the action and exposes `retry()` — an explicit product
 * decision (not "allow with a warning"), because the entire point of this
 * feature is to never act on unverified data.
 */

/** The minimal, structural shape this hook needs from a query result. No react-query import. */
export type FreshConfirmQueryResult<T> = {
  data: T | undefined;
  isError: boolean;
};

export type FreshConfirmQuery<T> = FreshConfirmQueryResult<T> & {
  refetch: () => Promise<FreshConfirmQueryResult<T>>;
};

export type FreshConfirmState = {
  /** The pre-confirm read is in flight — confirm must stay disabled. */
  isChecking: boolean;
  /** The fresh read differs from what the operator saw when the dialog opened. */
  isStale: boolean;
  /** The freshness check itself failed (network/server) — never treated as "unchanged". */
  isUnavailable: boolean;
  /** `isChecking || isStale || isUnavailable` — the single flag callers wire into `confirmDisabled`. */
  blocked: boolean;
  /** Re-attempts the freshness check without requiring the dialog to close and reopen. */
  retry: () => void;
};

type Phase = "idle" | "checking" | "fresh" | "stale" | "unavailable";

export function useFreshConfirm<T>(args: {
  /** Whether the dialog is currently open — drives when a fresh check runs. */
  open: boolean;
  /** What the operator is looking at right now (the value to freeze and compare against). */
  current: T | undefined;
  /** The query to refetch. Share ITS OWN key with the host page's detail query. */
  query: FreshConfirmQuery<T>;
  /** Domain-owned: does the fresh read count as "changed" relative to the frozen snapshot? */
  hasChanged: (fresh: T, snapshot: T) => boolean;
}): FreshConfirmState {
  const { open, current, query, hasChanged } = args;

  const [wasOpen, setWasOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<T | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("idle");
  const [retryToken, setRetryToken] = useState(0);

  // Render-time reset (not an effect): the instant `open` flips true,
  // freeze what the operator is looking at BEFORE any network round trip
  // — the same pattern `ApproveChequeDialog` already uses for its own
  // prop-driven local reset, not the "synchronize with an external
  // system" case `useEffect` is for.
  if (open && !wasOpen) {
    setWasOpen(true);
    setSnapshot(current);
    setPhase("checking");
  } else if (!open && wasOpen) {
    setWasOpen(false);
    setPhase("idle");
  }

  // "Latest ref" pattern: `query`/`hasChanged` are new references on every
  // render of the calling dialog (a fresh arrow function, a fresh
  // `useQuery` result object) — including them in the effect below's own
  // dependency array would re-fire the network call on every render, not
  // just on the `open`/`retry` transitions it actually cares about. Refs
  // give a stable place to read the LATEST value from — but this
  // codebase's lint config (the React Compiler's `react-hooks/refs` rule)
  // forbids writing a ref's `.current` during render itself, so the write
  // happens in this own unconditional effect (no dependency array — runs
  // after every commit) rather than inline above. Declared BEFORE the
  // fetch effect below so, within the same commit, the refs are always
  // updated first (React runs a component's effects in declaration order).
  const queryRef = useRef(query);
  const hasChangedRef = useRef(hasChanged);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    queryRef.current = query;
    hasChangedRef.current = hasChanged;
    snapshotRef.current = snapshot;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    queryRef.current
      .refetch()
      .then((result) => {
        if (cancelled) return;
        const snap = snapshotRef.current;
        if (result.isError || result.data === undefined || snap === undefined) {
          setPhase("unavailable");
          return;
        }
        setPhase(hasChangedRef.current(result.data, snap) ? "stale" : "fresh");
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [open, retryToken]);

  return {
    isChecking: phase === "checking",
    isStale: phase === "stale",
    isUnavailable: phase === "unavailable",
    blocked: phase === "checking" || phase === "stale" || phase === "unavailable",
    retry: () => {
      setPhase("checking");
      setRetryToken((n) => n + 1);
    },
  };
}
