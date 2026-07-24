# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-25_

---

## Current state

**M3 — Network / identity graph is COMPLETE.** All six sub-milestones (M3.1
Admins, M3.2 Managers, M3.3 Commercials, M3.4 Clients, M3.5 Client
bulk-assign, M3.6 Agent onboarding wizard) are implemented, tested, and —
for M3.6 specifically — manually validated against the real backend, with
every issue that validation found fixed across three follow-up rounds this
session. **The next milestone is M4 — Money** (roadmap: Cheques, Deposits,
Debt Payments — the product's first approval queues, first irreversible
confirmations, first cross-domain cache invalidation).

- **Code**: M3.6 (initial implementation plus all three post-validation fix
  rounds) is committed and pushed. Working tree is clean.
- **Tests**: 442/442 across 24 files, stable across four separate
  `pnpm test:ci` double-runs this session (one after initial implementation,
  one after each of the three fix rounds).
- **Quality gates**: typecheck, lint, format:check and build all pass, on
  every one of those four checkpoints.
- **Documentation**: this file and `project-status.md` are both current as
  of M3.6's close. **No new ADR was recorded** — none of the three
  post-validation fix rounds constituted a new architectural decision (see
  `project-status.md`'s M3.6 Follow-up 3/4/5 sections for exactly what each
  one changed and why none rose to that level).
- **Commit / push**: both done this session. This file does not
  self-reference the closing commit's own hash — this project's standing
  convention backfills a commit's hash from the *next* session, not the one
  making it (see how `bd09d2e` was recorded for M3.5, below).

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M3.6 closure commit at HEAD
pnpm test:ci               # expect: 442/442 across 24 files
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
  post-validation fix rounds — **committed and pushed this session.** The
  three rounds, in order: (1) Villes-backed City selects +
  `ManagerAreaMultiSelect` reuse + Fuel Amount relocated to Moto (gas-only)
  + Subscription Number relabelled; (2) Sector became a city-scoped select
  over Secteurs' `useSecteursQuery` + Moroccan phone-format validation on
  Phone Subscription Number; (3) a real Review-step auto-submit defect
  found and fixed (no button is ever `type="submit"` anymore) plus a
  same-tick double-click race closed with a synchronous ref guard. Full
  write-up: `project-status.md`'s M3.6 section and its Follow-up 3/4/5
  subsections.

## Next task: M4 — Money (roadmap M4, "the first irreversible actions")

**Do not start writing code before a discovery pass.** Every M3.x
sub-milestone began by reading the frozen documents' relevant sections and
verifying the real backend contract from source before scope was fixed
(`session-bootstrap.md` §3/§4) — M4 gets no exception. Read
`phase8-architecture.html`, `phase8-design-system.html` and
`phase8-frontend-technical-architecture.html`'s sections on Money and on
`ApprovalQueuePage` in full, then read the actual Money controllers in the
backend source (do not assume names or shapes from the roadmap's prose).
**Present a plan and wait for approval before implementing** —
`session-bootstrap.md` §4's own checklist, unchanged.

**What the frozen roadmap names for M4** (read
`phase8-frontend-implementation-roadmap.html`'s own M4 section directly —
this list is a pointer, not a substitute):

- Cheques: submission, pending queue, approve / reject / annuler.
- Deposits: list (filterable by type), validate, reject.
- Debt Payments: list + submit.
- `ApprovalQueuePage` — the first instance of this pattern in the product.
- **The freshness rule** (FTA §8): confirmation dialogs render from a fresh
  refetch and refuse the action if the record changed underneath the
  operator — the first time this product needs it.
- **The invalidation map** (FTA D-3), its first real entries — e.g.
  `cheque.approved` → agent capacity.
- Error-code registry entries for the Money domain's 409 families (FTA D-10).

**Depends on M3** (transactions attribute to agents) — satisfied, M3 is now
complete. **Does NOT depend on the M3.x detail-page milestone** (see below);
M4 has no nested routes of its own and is not blocked by FE-2.

## M3.x — Admin/Manager/Commercial detail pages: still open, still separate from M4

Unchanged from every prior handoff: ADR-0014 deferred these to their own
later milestone, not cancelled them — they are **not** one of M3's six
named sub-milestones and were never blocking M3's own closure. Still
blocked by **FE-2** (`withPermissionGuards` is shallow — a nested route's
own `handle.permission` is silently ignored in favour of its parent's).
**FE-2 MUST be fixed before the first nested detail route is introduced.**
M4 does not touch this; it has no nested routes.

## Things that MUST NOT be changed without a new decision (carried from M3.6, still standing)

- 🚫 **Do not add edit mode to the M3.6 wizard.** Create-only, by decision.
  Editing an existing agent belongs to the still-pending, FE-2-blocked
  detail-page milestone.
- 🚫 **Do not add an agent detail page.** ADR-0014, unchanged.
- 🚫 **Do not move `FileUploadField`/`TextField` to `shared/`.** Domain-local
  by explicit Rule-of-Three reasoning (repetition within one screen is not
  cross-resource evidence).
- 🚫 **Do not build a generic wizard framework.** FTA D-9 rejects a
  state-machine library for the one wizard in the product. A second wizard
  (Agent Transfers is the roadmap's own candidate) is the actual revisit
  trigger, not M4.
- 🚫 **Do not replace the bounded manager `<select>`, or the Sector
  `<select>` added in Follow-up 4, with an async entity picker.** Both are
  explicit, approved narrowings of Design System §12's entity-chip rule,
  recorded decisions, not oversights.
- 🚫 **Do not move the fuel-amount field or its essence cross-field
  validation back to the Financial step.** Both are deliberately on Moto —
  see the comment in `model/agent-onboarding.ts` before "fixing" this.
- 🚫 **Do not replace the credential success screen with toast-and-navigate.**
  ADR-0017.
- 🚫 **Do not give any button inside the onboarding wizard's `<form>` a
  `type="submit"`, and do not merge the Next/Review-confirm buttons back
  into a single shared JSX slot.** This is exactly the defect
  Follow-up 5 found and fixed — reintroducing it (even by refactoring the
  button bar "for cleanliness") reopens the same auto-submit bug.
  Submission must stay wired to `handleConfirm`'s `onClick` alone; see
  `project-status.md` for the full mechanism and the regression tests that
  pin it.
- 🚫 **Do not add localStorage/autosave draft persistence** to the wizard.
  The no-data-loss rule is about surviving a failed submission, not a
  browser reload.
- 🚫 **Do not modify existing tests** to accommodate an implementation
  without stopping to explain first — unchanged, standing rule.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-N, BC-U, BC-V, BC-W,
  BC-X and BC-Y are all standing examples of disclosed limitations, not
  problems to route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012).
- 🚫 **The cross-domain picker-export tally is now at "3"** (Managers →
  Commercials, Commercials → Clients, Secteurs → Agent Onboarding — see
  `project-status.md`). This is flagged as a real Rule-of-Three decision
  point for a future session, but do not extract anything reflexively just
  because the count is reached mid-M4-work — it needs a deliberate decision
  session, not a side effect of an unrelated milestone.

## Known follow-ups (carried, unchanged unless noted)

- [x] **M3.6 manual validation — DONE.** Three fix rounds applied, every
      quality gate re-verified after each. See `project-status.md`.
- [x] **M3.6 commit and push — DONE** this session.
- [ ] **FE-1 — test flake, unchanged.** Five older test files'
      `findByRole("alert")` calls still race the 1000ms default timeout.
      Suite is now at 442 tests across 24 files, stable across four
      double-runs this session. Recommended before the suite grows further
      — especially with M4's approval-queue tests coming.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking for M4
      (no nested routes there either). Must be fixed before the first
      detail-page milestone.
- [ ] **BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S — raise with the backend.**
      Unchanged from M3.5/M3.6.
- [ ] **ADR-0016 owed work** (M3.5's deferred all-pages bulk-assign step,
      "100 max" count copy) — not urgent, not started.
- [ ] **Rule-of-Three / shared-extraction decision — now genuinely due, not
      just close.** The cross-domain picker-export tally reached "3" during
      M3.6 Follow-up 4 (see `project-status.md`'s updated tally). Still not
      resolved — worth deciding explicitly early in M4's own discovery pass
      if Money needs a sibling picker too, rather than letting the count
      climb further unaddressed.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] M3.1–M3.6 and all their follow-ups closed out — see `project-status.md`.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
