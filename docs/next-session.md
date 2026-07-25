# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-25_

---

## Current state

**M3 is complete. M4 (Money) is underway: M4.1 (infrastructure) and all of
M4.2 — Cheques (Phase 1 domain model/API/queries, Phase 2 permissions/
routing/list page, Phase 3A creation, Phase 3B pending queue + detail page,
Phase 3C approve/reject/annuler including the allocation-split correction)
— are complete. The full Cheques workflow now exists end to end: submit,
list, pending queue, detail page, approve (with a rapped/grattage split),
reject, annuler.** M4.3 (Deposits) is the next milestone — **a fresh
discovery pass against the live backend is required before any
implementation starts**, per this session's own instruction; do not carry
forward Cheques' plan or assume Deposits mirrors it.

- **Code**: M4.1 and M4.2 (Phases 1 through 3C) are committed. Working tree
  is clean. `domains/money/cheques/` now has list, create, pending queue,
  detail page, and all three status actions (approve/reject/annuler) with
  their confirmation dialogs. No edit, no delete, no bulk actions, no
  attachments, no comments — none of these were ever in scope for Cheques.
- **Tests**: 548/548 across 29 files, quality gates (`typecheck`, `lint`,
  `format:check`, `build`) all clean, re-verified fresh this session.
- **Manual validation**: complete this session for the full Cheques
  workflow (list, create, pending queue, detail page, approve, reject,
  annuler) against the real running backend.
- **Documentation**: this file and `project-status.md` are both being
  brought current as of this session (M4.2 Phase 3B/3C close-out). No new
  ADR recorded — Phase 3B's routing choice (flat sibling routes, not a new
  `DetailPage`/`ApprovalQueuePage` shared pattern) and Phase 3C's
  `ConfirmActionDialog` extensions (`variant`, `reason`, `confirmDisabled`,
  `children`) are implementation-level decisions with their reasoning
  recorded in code comments and in `project-status.md`'s own Phase 3B/3C
  sections, the same treatment Phase 3A's two contract corrections got —
  not ADR-worthy architectural changes.
- **Commit / push**: `bba78d3` — `feat(money): complete cheque approval
  workflow` — committed AND pushed (`main` is level with `origin/main`).
  This single commit covers Phase 3B (pending queue, detail page) AND
  Phase 3C (approve/reject/annuler, including the allocation-split
  correction) together — both phases were implemented and committed in the
  same session before this documentation pass. 21 files changed,
  +2435/-33.

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect bba78d3 at HEAD
pnpm test:ci               # expect: 548/548 across 29 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers**, plus its live-validation nullability fix — committed as
  `d91d9a2` and `3b84d51`
- **M3.3 Commercials**, plus city-select and multi-city-selector follow-ups —
  committed as `700d99f`
- **M3.4 Clients** — committed as `eaaa78b`
- **M3.5 Client bulk-assign** — committed as `bd09d2e`
- **M3.6 Agent onboarding wizard**, plus its manual validation and three
  post-validation fix rounds — committed as `5dd20e8`
- **M4.1 Money infrastructure** — `normalizeError`'s `{error}` fallback,
  `StatusBadge`/`MoneyAmount`/`FileUploadField` extracted to
  `shared/components/business/`, the empty `invalidation-map.ts` scaffold —
  committed as `a7d4b07`, manually reviewed and validated first. Full
  write-up: `project-status.md`'s M4.1 section.
- **M4.2 Phase 1+2 — Cheques (list, read-only)** — domain model, API/mapper,
  flat query keys, `LIVE`-tier read-only hooks, all six Cheque permissions
  registered, `/money/cheques` route + nav entry, the Cheques list page,
  `DataTable`/`FilterBar` extracted to `shared/components/business/` —
  committed as `4b8f095`. Full write-up: `project-status.md`'s M4.2 section.
- **M4.2 Phase 3A — Cheques (creation)** — a backend contract mismatch
  caught and corrected BEFORE implementation (dropped Bank/Issue Date,
  added the required `photo_cheque` upload), `createCheque`/
  `useCreateChequeMutation` (first real `invalidateForEvent` caller),
  `CreateChequeAgentField`, the Create Cheque page/route — committed as
  `a601ee0`. Full write-up: `project-status.md`'s M4.2 Phase 3A section.
- **M4.2 Phase 3B — Cheques (pending queue + detail page) — DONE.**
  `PendingChequesPage` (reuses `ListPage`/`DataTable` directly — no new
  `ApprovalQueuePage` shared pattern, even though the frozen architecture
  doc names one for this screen; only one real consumer today, and the
  endpoint accepts no filters at all, so there is nothing "actionable" a
  queue-specific shell would add yet). `ChequeDetailPage` — the first
  detail page in this product (ADR-0014 deferred every Network one) — a
  domain-local page, also deliberately not a new shared `DetailPage`, same
  Rule-of-Three reasoning. Both decisions were explicitly raised and
  confirmed with the user before building, since they diverged from what
  the frozen docs/prior session's own plan called for. Routed as flat
  sibling routes (`/money/cheques/pending`, `/money/cheques/:id`), not
  nested — sidesteps FE-2 the same way `CHEQUES_NEW_PATH` already did.
  BC-Z (the `processed_by` relation bug) is left unmapped on the detail
  page rather than guessed at. Full write-up: `project-status.md`'s M4.2
  Phase 3B section.
- **M4.2 Phase 3C — Cheques (approve/reject/annuler) — DONE, in two
  passes.** First pass shipped Approve as a plain confirm (no allocation
  split, matching the task's initial scope). **A follow-up correction then
  re-verified `ChequeController::approve`'s validator and found the
  original "simple confirm" scope decision no longer matched what was
  asked** — Approve was rebuilt with a real Rapped/Grattage allocation
  split, cents-safe sum validation, and the load-bearing contract fact that
  `allocations.*.amount`'s `min:0.01` rule REJECTS a zero-value entry
  outright (a zero side must be omitted from the payload, never sent as
  `amount: 0`). Reject/Annuler collect a required `decision_reason` via a
  new `reason` slot on `ConfirmActionDialog`. `ConfirmActionDialog` itself
  gained four generic extensions this phase — `variant` (fixes the
  previously-flagged destructive-only blocker below), `reason`,
  `confirmDisabled`, and `children` (a block-level content slot, added
  after a real invalid-HTML-nesting warning surfaced from putting `<div>`s
  inside `SheetDescription`'s `<p>`) — all additive, none of the prior 8
  callers changed. `cheque.approved`/`cheque.rejected`/`cheque.annuled` are
  now registered in `invalidation-map.ts`. Full write-up:
  `project-status.md`'s M4.2 Phase 3C section.

## Next task: M4.3 — Deposits

**Do a fresh discovery pass first — do not begin implementation.** Per this
session's own explicit instruction, do not carry forward Cheques' plan or
assume Deposits mirrors its shape. Re-read `DepositController` (or
equivalent), `DepoResource`, the routes, permissions and validation rules
directly from source before proposing any scope, the same discipline every
Cheques phase applied.

**The previously-recorded blocker is RESOLVED, verified from source this
session**: `DepoResource` was checked fresh against the file at
`app/Http/Resources/DepoResource.php` and now includes both `'status' =>
$this->status` and `'type' => $this->type` in its `toArray()` — confirmed
via `git log` on the backend repo (`039685c feat(deposits): expose status
and type on DepoResource`). The prior finding ("Deposits' `DepoResource`
omits `type` and `status` from the wire entirely... raise with the backend
before starting M4.3's list screen") no longer applies. **Still
re-verify this directly from source at the start of M4.3's own discovery
pass** — do not treat this note as a substitute for that session's own
contract check; it is a starting fact, not a shortcut past the standing
discipline.

### Deposits and Debt Payments — other carried findings, not yet re-verified

Brief pointers only, carried from the original M4 discovery pass; **all of
these need a fresh look at the start of M4.3's own discovery**, not an
assumption carried forward unchecked:

- **Deposits and Debt Payments fail with `{"error": "..."}`, not
  `{"message": "..."}`** — already handled by M4.1's `normalizeError`
  fallback, so not a blocker, just a fact worth re-confirming when writing
  Deposits' own mapper.
- **Debt Payments is scoped to the logged-in admin only** — no `admin_id`
  filter exists anywhere, `debt_cash` is seeded to `super-admin` only (not
  `admin`). Whether this is a Money list screen or an Admin-profile panel
  is an open product question — raise it before M4.4's routing/placement
  is fixed, not after building it as a `ListPage`. (M4.4 is later than
  M4.3 — Deposits goes first.)
- **`DebtPayment::destroy` route is commented out**; the controller method
  (with a 5-minute self-service delete window) is dead code. Do not build a
  delete UI without confirming this is intentional. (Also M4.4, not M4.3.)

### Known infrastructure now available for Deposits to reuse (verify fit, don't assume)

- `ConfirmActionDialog` now supports `variant` (destructive/default),
  `reason` (a required free-text field), `confirmDisabled` (a generic
  caller-owned validity gate), and `children` (block-level custom content
  outside `SheetDescription`'s `<p>`) — all additive extensions from
  Cheques' Phase 3C. If Deposits' validate/reject actions need any of
  these shapes, reuse is likely appropriate — but re-derive the fit for
  Deposits' own contract rather than assuming it matches Cheques'.
- `invalidateForEvent`/`invalidation-map.ts` is now a proven mechanism with
  four real entries (`cheque.created`/`approved`/`rejected`/`annuled`).
  Register Deposits' own events only once its mutations exist — do not
  register ahead of them.
- `DataTable`/`FilterBar`/`ListPage`/`ListLoadingState`/`ListErrorState`/
  `ListEmptyState` are all proven, reused unchanged by Cheques' two list
  screens. No new shared pattern (`ApprovalQueuePage`, `DetailPage`) was
  built for Cheques despite the frozen docs naming both — Deposits' own
  pending/validate queue is a second real candidate for `ApprovalQueuePage`
  specifically; whether two consumers now meet this codebase's evidence
  bar is a real decision to raise at M4.3's discovery, not to resolve here
  ahead of that pass.

## Things that MUST NOT be changed without a new decision (carried, still standing)

- 🚫 **Do not add edit mode to the M3.6 wizard**, an agent detail page, or
  move `TextField` to `shared/`. Unchanged (ADR-0014, Rule-of-Three).
- 🚫 **Do not build a generic wizard framework.** FTA D-9. Unchanged.
- 🚫 **Do not replace the bounded manager/sector `<select>`s with an async
  entity picker** without a fresh, explicit decision.
- 🚫 **Do not move the fuel-amount field/validation back to Financial**, or
  replace the credential success screen (ADR-0017). Unchanged.
- 🚫 **Do not give any wizard button `type="submit"`.** Unchanged — see
  M3.6 Follow-up 5.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties**
  to `index.css` as a side effect of a Deposits screen. `StatusBadge`'s
  M4.1 color implementation (direct Tailwind utilities) was a deliberate,
  scoped choice.
- 🚫 **Do not retrofit Villes/Managers/Commercials/Clients onto
  `DataTable`/`FilterBar`** as a side effect of Deposits work; that
  migration is separate, larger, and remains explicitly out of scope.
  `EntityChip` and the URL-filter hook remain genuinely unextracted — do
  not build either reflexively.
- 🚫 **`CreateChequeAgentField` stays its OWN component**, not merged with
  `ChequeAgentFilter` — a filter's `""` is a permanent valid state, a create
  field's is not. Cheques' detail page and its three action dialogs
  (approve/reject/annuler) confirmed this pattern needs no further agent
  picker of their own (none of the three actions display or edit an agent),
  so this stays fully resolved, not reopened by Phase 3B/3C.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-N, BC-U, BC-V,
  BC-W, BC-X, BC-Y, BC-Z and the Debt-Payments findings above are all
  standing disclosed limitations, not problems to route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012) —
  Cheques/Deposits/Debt Payments each keep their own.
- 🚫 **Do not register a Deposits domain event in `invalidation-map.ts`
  ahead of the mutation that emits it** — the same discipline that governed
  `cheque.approved`/`rejected`/`annuled`, all now registered only because
  their real mutations exist.

## Known follow-ups (carried, unchanged unless noted)

- [x] **M4.1 infrastructure — DONE.** See `project-status.md`.
- [x] **M4.2 Phase 1+2 (Cheques: list, read-only) — DONE.** See `project-status.md`.
- [x] **M4.2 Phase 3A (Cheques: creation) — DONE.** See `project-status.md`.
- [x] **M4.2 Phase 3B (Cheques: pending queue + detail page) — DONE.** See
      `project-status.md`.
- [x] **M4.2 Phase 3C (Cheques: approve/reject/annuler, incl. allocation
      split) — DONE.** See `project-status.md`.
- [x] **M4.2 manual validation, full Cheques workflow — DONE** this
      session, against the real running backend.
- [ ] **M4.3 Deposits — NEXT. Fresh discovery pass required before any
      implementation.** The `DepoResource` blocker is resolved (see above);
      still re-verify everything from source at the start of that pass.
- [ ] **M4.4 Debt Payments — contingent on the placement/permission
      product questions above.** Later than M4.3.
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 548 tests across 29
      files. No flake observed this session's runs. Recommended before
      Deposits' own tests add meaningfully more.
- [ ] **FE-2 — nested-route guard.** Unchanged, still non-blocking. Cheques'
      detail page (Phase 3B) was this product's first real test of whether
      a nested route was actually needed — it wasn't: a flat sibling route
      worked fine, same as every prior domain. FE-2 remains an open fix,
      just still not on the critical path.
- [ ] **BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S — raise with the backend.**
      Unchanged this session.
- [ ] **BC-Z — raise with the backend.** Still open — Cheques' detail page
      (Phase 3B) deliberately does not display "processed by" rather than
      show the known-wrong value.
- [ ] **ADR-0016 owed work** (M3.5's deferred all-pages bulk-assign step) —
      not urgent, not started.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the
      URL-filter-hook question — still the two live decision points.**
      Neither Phase 3B nor 3C moved the export tally. Still unresolved.
- [ ] **`ApprovalQueuePage`/`DetailPage`, still not extracted.** Cheques'
      Phase 3B built both screens domain-locally rather than as new shared
      patterns (one consumer each, at the time). If Deposits' own pending
      queue and/or detail page turn out to need the same shape, that is
      the second real consumer — raise the extraction decision explicitly
      at M4.3's discovery rather than assuming either way.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] M3.1–M3.6, M4.1 and all of M4.2 (Phases 1 through 3C) closed out —
      see `project-status.md`.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
