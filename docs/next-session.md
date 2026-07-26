# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-26_

---

## Current state

**M4 (Money) is COMPLETE — all three resources (Cheques, Deposits, Debt Payments) now
exist end to end**, and the FTA §8 freshness rule (`useFreshConfirm`) has been
retrofitted onto every irreversible Money confirmation. **M5 (Stock) is underway: a
full discovery pass and its first two phases — Agent Stock Returns and Agent
Transfers — are both complete.** `next-session.md` and `project-status.md` had not
been updated across any of M4.3 (Deposits), M4.4 (Debt Payments), the freshness
retrofit, M5's discovery, or its own two phases — each of those sessions was told
explicitly not to touch documentation, commit, or push, deferring the sync to this
one. **This session's own job was exactly that catch-up**, not new implementation.

- **Code**: everything through Agent Transfers is committed and pushed (see "Last
  completed work" below for the exact commit list). Working tree is clean except for
  this documentation pass.
- **Tests**: 825/825 across 42 files. `pnpm lint`/`pnpm typecheck`/`pnpm format:check`/
  `pnpm build` all clean, re-verified this session.
- **Manual validation**: Cheques' full workflow and Agent Stock Returns are both
  manually validated against the real running backend. **Deposits, Debt Payments and
  Agent Transfers have NOT had a manual browser pass yet** — each shipped on
  implementation-level verification (full automated suites, quality gates, file-by-file
  review) only.
- **Documentation**: this file, `project-status.md` and `decisions.md` were all
  brought current this session. `decisions.md` gained five new entries (ADR-0018
  through ADR-0022) recording decisions that had become permanent across M4/M5 but
  were never written down. `implementation-status.md` was **NOT** touched — it has not
  been appended to since M3.1 and is now a substantial backfill on its own; flagged
  for the user as a separate, explicit task rather than assumed in scope here.

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect e559e76 at HEAD (before this doc commit, if made)
pnpm test:ci               # expect: 825/825 across 42 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## Last completed work

- **M3.1 through M3.6** — see prior entries in this file's own git history, or
  `project-status.md`'s own write-ups. All committed; M3.6 is `5dd20e8`.
- **M4.1 Money infrastructure** — `a7d4b07`.
- **M4.2 Cheques, Phase 1+2 (list, read-only)** — `4b8f095`.
- **M4.2 Cheques, Phase 3A (creation)** — `a601ee0`.
- **M4.2 Cheques, Phase 3B+3C (pending queue, detail page, approve/reject/annuler)**
  — `bba78d3`.
- **M4.3 Deposits, Phase 1 (list)** — `dcb8380`.
- **M4.3 Deposits, Phase 2 (detail page)** — `6ab02a5`. `DepoResource` changed shape a
  second time underneath the M4 discovery pass's own earlier reading (commit
  `8786326`, unifying `index()`/`show()`/`store()` and adding
  `reject_reason`/`validated_by`/`validated_at`/`bank_name`/`proof_type`) — re-verified
  fresh at this phase's own start, not assumed from the discovery pass.
- **M4.3 Deposits, Phase 3 (validate/reject actions)** — `a64f42f`.
- **M4.3 Deposits, Phase 4 (creation)** — `4dd4d63`. M4.3 is now fully complete.
- **M4.4 Debt Payments** — `c0d3f36`. The third and final Money resource: list +
  submit only, no detail page (`show()`/`destroy()` are dead routes), no lifecycle
  (no `status`/`type` column at all). M4 is now fully complete.
- **Freshness-rule retrofit** — `7da7804`. Built `useFreshConfirm` (`shared/hooks/`)
  and retrofitted it onto all five existing irreversible Money dialogs (Cheques'
  Approve/Reject/Annuler, Deposits' Validate/Reject). See ADR-0018.
- **M5 Phase 1 — Agent Stock Returns** — `49af3b7`. The first Stock resource, the
  first domain with a real error-code registry population (13 codes), first caller
  of the newly-extracted `LineItemsEditor` (ADR-0019). Manually validated.
- **M5 Phase 2 — Agent Transfers** — `e559e76`. Mirrors Return's shape but its own
  15 error codes, permission names and `validation_summary` keys were each verified
  independently, not derived mechanically (ADR-0022) — several genuinely diverge
  from Return's own (see `project-status.md`'s own M5 Phase 2 section for the exact
  list). Its own domain-local Manager→Commercial picker (ADR-0021). Manual browser
  validation still owed.

Full write-ups for every item above: `project-status.md`'s own dedicated sections.

## Next task: M5 Phase 4 — Allocations

**Do a fresh discovery pass first — do not begin implementation.** Per the same
discipline every M4/M5 phase applied (and per ADR-0022, now a standing decision, not
just a convention): re-read `AllocationController`, `AllocationResource`, the
`Allocation`/`AllocationLine` models, their FormRequests and permission registrations
directly from source before proposing any scope. **Do not assume Allocations mirrors
Agent Stock Returns' or Agent Transfers' shape** — the M5 discovery pass itself
already found Allocations' binding rule is structurally different from both
(`company_id` + `agent_id(role=manager)`, no manager↔commercial relationship at all —
this is WHY the Manager→Commercial picker stays domain-local, ADR-0021, rather than
becoming a third consumer of that pattern).

**What is known and safe to reuse, verify-don't-assume:**

- `LineItemsEditor` (`shared/components/business/`) — its own line contract
  (`product_id`, `quantity`, `unit_cost`, `notes`) was verified identical across ALL
  FOUR Stock movement types' FormRequests, including Allocation's, before extraction
  (ADR-0019). Re-verify `StoreAllocationLineRequest` at the start of this phase
  regardless — the contract may have drifted since M5's own discovery pass read it.
- `useFreshConfirm` (`shared/hooks/`) — reuse for Allocation's own validate
  confirmation, giving its freshness query its OWN cache key (never the detail
  query's), the same discipline both Stock callers already applied (ADR-0018).
- The error-code registry — register EVERY Allocation code explicitly from
  `AllocationExceptionRenderer` (or equivalent), never as a mechanical rename of
  Return's or Transfer's own codes. Assume nothing carries over unchanged (ADR-0022).
- The Manager→Commercial picker — **do NOT reuse or generalize
  `ReturnManagerCommercialField`/`TransferManagerCommercialField`** for Allocations.
  Its own binding rule is a different pair entirely; building a picker around it (if
  one is even needed) is new, domain-local work, not a third consumer of the existing
  pattern (ADR-0021).

## Things that MUST NOT be changed without a new decision (carried, updated this session)

- 🚫 **Do not add edit mode to the M3.6 wizard**, an agent detail page, or move
  `TextField` to `shared/`. Unchanged (ADR-0014, Rule-of-Three).
- 🚫 **Do not build a generic wizard framework.** FTA D-9. Unchanged.
- 🚫 **Do not replace the bounded manager/sector `<select>`s with an async entity
  picker** without a fresh, explicit decision.
- 🚫 **Do not give any wizard button `type="submit"`.** Unchanged — M3.6 Follow-up 5.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties** to
  `index.css` as a side effect of any future screen. `StatusBadge`'s M4.1 color
  implementation (direct Tailwind utilities) was a deliberate, scoped choice.
- 🚫 **Do not retrofit Villes/Managers/Commercials/Clients onto `DataTable`/
  `FilterBar`** as a side effect of unrelated work; that migration remains separate,
  larger, and out of scope. `EntityChip` and the URL-filter hook remain genuinely
  unextracted.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** Every BC-code in `project-status.md`'s
  Backend dependencies section is a standing disclosed limitation, not a problem to
  route around.
- 🚫 **Do not merge mappers, key factories, or Manager→Commercial pickers** across
  domains (ADR-0012, ADR-0021).
- 🚫 **Do not register a domain event in `invalidation-map.ts` ahead of the mutation
  that emits it.** Unchanged discipline, now with 15+ real entries.
- 🚫 **`ConfirmActionDialog` may gain new generic props, never a domain-named one**
  (ADR-0020). If a new action needs behavior it cannot express, design a new
  component — do not smuggle a business conditional into this one.
- 🚫 **Do not give any freshness-check query (`useFreshConfirm`'s `query` argument)
  the SAME cache key as its host page's own detail query.** A shared key lets a
  transient verification failure corrupt the host page's own display (ADR-0018).
  Every callsite so far (Cheques, Deposits, both Stock resources) gives its
  freshness query its own, distinct key — keep doing that.
- 🚫 **Do not build a proactive capacity/stock-quantity hint anywhere in Stock.** No
  read endpoint exists for it yet (BC-AA); every capacity/stock-insufficient check is
  handled reactively, by explicit decision, until that changes.
- 🚫 **Do not derive a new Stock resource's error codes, permission names, or
  `validation_summary`/response keys mechanically from an existing resource's own.**
  Register each one explicitly, verified fresh from its own `*ExceptionRenderer` and
  Resource class (ADR-0022) — Transfer's own codes diverged from Return's in
  specific, named ways precisely because this discipline was followed.

## Known follow-ups (carried, updated this session)

- [x] **M4 (Cheques, Deposits, Debt Payments) — fully DONE.** See `project-status.md`.
- [x] **Freshness-rule retrofit (`useFreshConfirm`) — DONE.**
- [x] **M5 discovery, Phase 1 (Agent Stock Returns), Phase 2 (Agent Transfers) — DONE.**
- [ ] **M5 Phase 4 — Allocations — NEXT. Fresh discovery pass required before any
      implementation.**
- [ ] **M5 Phase 5 — Bons.** Later than Allocations.
- [ ] **Manual browser validation owed** for Deposits, Debt Payments, and Agent
      Transfers — none of the three has had a real end-to-end pass yet.
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 825 tests across 42 files. One
      transient flake observed on a full parallel run this session (confirmed as a
      flake, not a regression, by both an isolated re-run and a second full clean
      run). Recommended before the suite grows further.
- [ ] **FE-2 — nested-route guard.** Unchanged, still non-blocking. No Stock resource
      has needed a nested route either — every one so far ships flat sibling routes.
- [ ] **BC-AA — no stock-quantity read endpoint anywhere.** Raise with the backend.
      Blocks any proactive capacity hint and any future Stock ledger view.
- [ ] **BC-AB — only Bons has a `/cancel` route.** Raise with the backend. No cancel
      UI exists for Allocations/Agent Transfers/Agent Stock Returns.
- [ ] **B-1 — Companies/Suppliers controllers do not exist.** Unchanged since M0.
      Blocks the Stock directory screens specifically, not the four movement types.
- [ ] **BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S, BC-Z — raise with the backend.** Unchanged.
- [ ] **`implementation-status.md` has not been appended to since M3.1** — this
      session deliberately left it alone (a full historical backfill through M2–M5 is
      a distinct, larger task from this session's own documentation-sync scope). Flag
      to the user; do not silently attempt the backfill inside an unrelated task.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the URL-filter-hook
      question — still the two open decision points from M3/M4.** Unaffected by M5.
- [ ] **`ApprovalQueuePage`/`DetailPage` tally now at "2"** (Cheques, Deposits) — a
      genuine third consumer would be the actual decision point; still not reached.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
      Unchanged.
- [ ] Gate G2 formal closure — unchanged, governance only.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
