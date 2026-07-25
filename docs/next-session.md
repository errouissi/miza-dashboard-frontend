# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-25_

---

## Current state

**M3 is complete. M4 (Money) is underway: M4.1 (infrastructure), M4.2
Phase 1 (domain model, API, queries), Phase 2 (permissions, routing, list
page, DataTable/FilterBar extraction) and Phase 3A (cheque creation) are
all complete, implementation-level reviewed, and closed out. M4.2 Phase 3B
(pending queue, detail page) is next, not started.** Approve/reject/annuler
(with the allocation-split sub-form) remain planned but are not yet
assigned to a specific phase letter — treat them as scope to confirm before
starting, not as automatically bundled into 3B. A full M4 discovery pass
(architecture proposal, domain boundaries, API inventory, business rules,
risks, unknowns — across Cheques, Deposits and Debt Payments, verified from
the live backend source) ran before M4.1's implementation. The API
inventory and business rules below are unchanged from that pass (submit's
own row is now marked implemented) and still the source for Phase 3B; the
rest (Deposits'/Debt Payments' own findings) is summarized briefly further
down and re-verified properly when M4.3/M4.4 start.

- **Code**: M4.1 (infrastructure) and M4.2 Phase 1+2+3A (Cheques: model,
  API, queries, permissions, routing, list page, create page) are committed
  and pushed. Working tree is clean. `domains/money/cheques/` now has list
  AND create; still no pending queue, no approve/reject/annuler, no detail
  page, no edit, no delete, no bulk actions, no attachments, no comments.
- **Tests**: 489/489 across 27 files, stable across two standalone
  `pnpm test:ci` runs this session.
- **Quality gates**: typecheck, lint, format:check and build all pass.
- **Documentation**: this file and `project-status.md` are both current as
  of M4.2 Phase 3A's close. No new ADR was recorded — the two contract
  corrections (dropping Bank/Issue Date, adding the required photo) and the
  `invalidateForEvent` first-caller decision are recorded as findings/
  architecture notes in `project-status.md`'s M4.2 Phase 3A section, not
  ADR-worthy architectural changes.
- **Manual validation status — genuinely incomplete, not just untested,
  for BOTH the list and create pages now**: neither has been exercised
  against the real running backend in a browser yet. The create page can
  now, for the first time, actually be tested end-to-end once a real
  session with `create-cheque` is available — do this before Phase 3B
  builds the pending queue against real, created data.
- **Commit / push**: both done this session. This file does not
  self-reference the closing commit's own hash — backfilled next session,
  per this project's standing convention (see how `5dd20e8` is recorded for
  M3.6, below).

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M4.2 Phase 3A closure commit at HEAD
pnpm test:ci               # expect: 489/489 across 27 files
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
  committed and pushed, manually reviewed and validated first. Full
  write-up: `project-status.md`'s M4.1 section.
- **M4.2 Phase 1+2 — Cheques (list, read-only)** — domain model
  (`Cheque`/`ChequeAllocation`/`ChequeListParams`, `amount` corrected to
  `string`), API/mapper, flat query keys, `LIVE`-tier read-only hooks, all
  six Cheque permissions registered, `/money/cheques` route + nav entry,
  the Cheques list page (search/status/agent/date filters, pagination),
  `DataTable`/`FilterBar` extracted to `shared/components/business/` (first
  real callers), plus a post-approval implementation-level verification
  pass (route-authorization coverage fix, new `cheques-list-page.test.tsx`)
  — committed and pushed, implementation-level reviewed first. Full
  write-up: `project-status.md`'s M4.2 section.
- **M4.2 Phase 3A — Cheques (creation)** — a backend contract mismatch
  caught and corrected BEFORE implementation (dropped Bank/Issue Date,
  which have no backing column/fillable/validator anywhere; added the
  required `photo_cheque` upload the original field list omitted), the
  `createChequeSchema` zod model, `createCheque`/`useCreateChequeMutation`
  (the first real caller of M4.1's `invalidateForEvent`, registering
  `"cheque.created"`), `CreateChequeAgentField` (a create-field-shaped
  sibling of `ChequeAgentFilter`, not a reuse of it), the Create Cheque
  page and route (`CHEQUES_NEW_PATH`, gated on `create-cheque`), a "Create
  Cheque" list-page button, and `create-cheque-page.test.tsx` (14 tests) —
  **committed and pushed this session, implementation-level reviewed first
  (full manual browser validation still pending, see "Current state"
  above).** Full write-up: `project-status.md`'s M4.2 Phase 3A section.

## Next task: M4.2 Phase 3B — Cheques pending queue + detail page

**Do not start writing code before presenting a plan and getting approval**
(`session-bootstrap.md` §4 — unchanged). The API inventory and business
rules below are already verified from source (the M4 discovery pass, plus
Phase 1/2/3A's own re-verification); they do not need re-verifying from
scratch, but re-read `ChequeController.php` and the `Cheque`/
`ChequeAllocation` models directly before writing the pending-queue query
or the detail-page mapper, per this project's standing discipline of
reading the controller before trusting a summary of it.

### Scope (per the discovery pass's recommended order — list and create are now done)

Pending queue (`ApprovalQueuePage`, first instance) → detail
(`DetailPage`, first instance). Approve (including the allocation-split
sub-form), reject and annuler are NOT bundled into this phase by default —
confirm scope explicitly before building any of the three action mutations
or their dialogs; `ConfirmActionDialog`'s hardcoded `variant="destructive"`
(below) needs a decision before Approve specifically can use it. Cheques go
first among the three M4 resources — richest, best-specified, cleanest
single envelope shape (`{success,message,data}`, the one Money resource
that already matches every Network domain's convention) — the right one to
prove `ApprovalQueuePage`/`DetailPage` against before Deposits (which has
its own backend gap, see below) or Debt Payments (which has its own
unresolved placement question).

**The submit-form agent-picker decision is RESOLVED, not still open**:
Phase 3A built `CreateChequeAgentField` as its own component (NOT a reuse
of `ChequeAgentFilter`), because a filter's "" is a permanent valid state
and a create field's is not. If the detail page or a future action dialog
needs its own agent display/picker, make the same kind of explicit,
re-derived call — do not assume either existing component fits without
checking. `BC-Z` (below) still blocks a correct "processed by" field on
the detail page until raised with the backend — do not guess at a value
for it.

### API inventory (verified from source)

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| POST | `/admin/cheques` | `create-cheque` | **IMPLEMENTED, Phase 3A.** multipart; exactly `agent_id`/`amount`/`num_cheque`/`photo_cheque` (required image ≤2MB) — no Bank, no Issue Date, confirmed absent from the migration/`$fillable`/validator, not just the roadmap's prose |
| GET | `/admin/cheques` | `view-cheques` | **IMPLEMENTED, Phase 2.** filters: `statute` (`en_attente/accepter/rejetee/annuler`), `agent_id`, `date_from`, `date_to`, `search` (num_cheque only), `per_page` (max 100) |
| GET | `/admin/cheques/pending` | `view-pending-cheques` | no filters, oldest-first |
| GET | `/admin/cheques/{id}` | `view-cheques` | includes `status_label`, eager-loads `allocations` |
| PUT | `/admin/cheques/{id}/approve` | `approve-cheque` | optional `allocations:[{type,amount}]`; omitted → 100% rapped |
| PUT | `/admin/cheques/{id}/reject` | `reject-cheque` | requires `decision_reason` |
| PUT | `/admin/cheques/{id}/annuler` | `annuler-cheque` | approved-only; reverses balances; negative-balance guard |
| GET | `/admin/cheques/agent/{agentId}` | `view-cheques` | full history + per-status sums, unpaginated |

Six granular permissions (`create-cheque`, `view-cheques`,
`view-pending-cheques`, `approve-cheque`, `reject-cheque`,
`annuler-cheque`) — all seeded, but **only to `super-admin`**; the `admin`
role holds none of them in the current seed. There is no non-super-admin
account to exercise a partial-permission path with — register a new
finding if this still blocks fail-closed QA the way BC-A already does for
Network.

### Business rules (verified from source)

- **Approve, split allocations**: optional `allocations:[{type:
  rapped|grattage, amount}]`, max 2 entries, unique types, sum must
  `bccomp`-equal the cheque amount exactly. Omitted → single 100% rapped.
  `rapped` → `agent.solde` + `agent.montant_avance_rapped`; `grattage` →
  `agent.montant_avance_grattage` only, never `solde`.
- **Annuler**: approved-only. Reverses per-allocation (or a 100%-rapped
  legacy fallback for pre-split cheques). Negative-balance guard refuses if
  the agent already spent below the reversal amount — this ONE rejection
  is field-mapped (`errors` key), unlike the others below.
- **Reject**: pending-only, no balance effect.
- **"Already processed"** (approve/reject called on a non-pending cheque):
  400, `{success:false, message}`, **no `code`** — normalizes to
  `kind:"unknown"`, same class as BC-X. Not fixable client-side.
- Cheque numbers are globally unique. Photo: image-only, 2MB.
- Pre-Phase-2 `rejected` cheques with no `cheque_allocations` rows are
  **permanently ambiguous** between a genuine rejection and a legacy
  pre-split cancellation — documented in the backend's own migration as
  intentionally left this way. Do not claim more certainty than the data
  supports on a historical row.
- **BC-Z, new at Phase 1** (full write-up in `project-status.md`'s Backend
  dependencies table): `show()` eager-loads the wrong relation for
  `processed_by` (`processedBy(): belongsTo(Agent::class, ...)` instead of
  `index()`'s correct `processedByUser(): belongsTo(User::class, ...)`),
  overwriting the raw FK with a mismatched result. The detail page (this
  phase) cannot show a correct "processed by" name until this is raised
  with the backend — do not model it from `show()`'s response as-is.

### The invalidation map's remaining entries (M4.2 continues populating `invalidation-map.ts`)

`"cheque.created"` is REGISTERED already (Phase 3A, `[["cheques"]]` only —
creation touches no balance column). Still to add, when the mutations that
emit them exist: `cheque.approved`/`cheque.annuled` write
`agent.montant_avance_rapped`/`montant_avance_grattage` — the SAME columns
Managers'/Commercials' list already renders as `avanceTotal`. Register:

```
cheque.approved  -> ['money','cheques'], ['network','managers'], ['network','commercials']
cheque.annuled   -> ['money','cheques'], ['network','managers'], ['network','commercials']
cheque.rejected  -> ['money','cheques']   (no balance columns touched — confirmed from source)
```

Invalidating both Network prefixes is deliberate even though only one role
applies to any given cheque — the agent's role isn't known without an
extra read, and over-invalidating a cheap `SLOW`-tier list is far safer
than under-invalidating.

### Known infrastructure risks to design around

- **`ConfirmActionDialog` is hardcoded `variant="destructive"`.** STILL
  UNRESOLVED — Approving a cheque is not a destructive action visually —
  needs a `variant` prop or a sibling component before an Approve dialog is
  built (not this phase's scope, but relevant the moment it is). Reject/
  Annuler fit the existing destructive styling fine.
- **No cross-role agent search endpoint** — unchanged fact. **The
  create-field-vs-filter merge-pattern decision IS RESOLVED** (Phase 3A
  built `CreateChequeAgentField` as its own component, not a reuse of
  `ChequeAgentFilter` — see "Scope" above); if the detail page needs to
  display or edit an agent, make the equivalent explicit call for that
  context rather than assuming either existing component fits.
- **Query tiers**: Cheques list AND create are both done (list is `LIVE`,
  `refetchOnWindowFocus: true`, from Phase 1; create has no query of its
  own, only the mutation). Still to decide for Phase 3B: Pending queue →
  `LIVE`, `refetchOnWindowFocus: true`, same tier as the list (FTA §8 names
  pending cheques explicitly under this tier); a cheque read inside a
  future approve/reject/annuler confirmation → `CRITICAL` (the freshness
  rule — FTA §8 — applies here for the first time in this product: refetch fresh
  immediately before confirming, and refuse if the record changed
  underneath the operator).

## Deposits and Debt Payments — carried findings, not yet actioned

Brief pointers only; re-verify properly when M4.3/M4.4 actually start
(these are more unsettled than Cheques and deserve their own fresh look,
not an assumption carried forward unchecked):

- **Deposits' `DepoResource` (the only thing `GET /admin/depos` and
  `GET /admin/depos/{id}` return) omits `type` and `status` from the wire
  entirely** — confirmed from the resource class itself. Blocks a
  StatusBadge column, a status filter, or the type tab
  `phase8-architecture.html` explicitly calls for. **Raise with the backend
  before starting M4.3's list screen** — do not build around it silently.
- **Deposits and Debt Payments fail with `{"error": "..."}`, not
  `{"message": "..."}`** — this is now handled by M4.1's `normalizeError`
  fallback, so this is no longer a blocker, just a fact worth knowing when
  writing their mappers.
- **Debt Payments is scoped to the logged-in admin only** — no `admin_id`
  filter exists anywhere, `debt_cash` is seeded to `super-admin` only (not
  `admin`). Whether this is a Money list screen or an Admin-profile panel
  is an open product question — raise it before M4.4's routing/placement
  is fixed, not after building it as a `ListPage`.
- **`DebtPayment::destroy` route is commented out**; the controller method
  (with a 5-minute self-service delete window) is dead code. Do not build a
  delete UI without confirming this is intentional.

## Things that MUST NOT be changed without a new decision (carried, still standing)

- 🚫 **Do not add edit mode to the M3.6 wizard**, an agent detail page, or
  move `TextField` to `shared/`. Unchanged (ADR-0014, Rule-of-Three).
- 🚫 **Do not build a generic wizard framework.** FTA D-9. Unchanged.
- 🚫 **Do not replace the bounded manager/sector `<select>`s with an async
  entity picker** without a fresh, explicit decision — this is the exact
  question M4.2's own agent picker now re-raises; do not silently resolve
  it by copying the M3.6 narrowing without re-deriving it.
- 🚫 **Do not move the fuel-amount field/validation back to Financial**, or
  replace the credential success screen (ADR-0017). Unchanged.
- 🚫 **Do not give any wizard button `type="submit"`.** Unchanged — see
  M3.6 Follow-up 5.
- 🚫 **Do not register a Money domain event in `invalidation-map.ts` ahead
  of the mutation that emits it.** `"cheque.created"` is now registered
  (Phase 3A, the first real entry and the first real caller of
  `invalidateForEvent`) — `cheque.approved`/`cheque.rejected`/
  `cheque.annuled` are still NOT registered, and stay that way until the
  mutations that emit them actually exist. The exact entries to register
  for those three (invalidating `['cheques']` — flat, per Phase 1's own
  key-shape decision — plus both Network prefixes for approve/annuler) are
  already spelled out above; do not re-derive from scratch, but do
  re-verify the key shape is still `["cheques", ...]` before writing them.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties**
  to `index.css` as a side effect of a Cheques screen. `StatusBadge`'s
  M4.1 color implementation (direct Tailwind utilities) was a deliberate,
  scoped choice — revisit it explicitly if it needs to change, don't drift
  into it.
- 🚫 **`DataTable`/`FilterBar` are now real, extracted shared components
  (M4.2 Phase 2)** — consumed by Cheques' list page only (the create page
  has no table/filter row of its own; Phase 3A did not touch either).
  **Do not retrofit Villes/Managers/Commercials/Clients onto them** as a
  side effect of Phase 3B work; that migration is separate, larger, and was
  explicitly out of scope when the extraction happened. `EntityChip` and
  the URL-filter hook remain genuinely unextracted — do not build either
  reflexively either.
- 🚫 **This decision is RESOLVED, do not re-litigate it**: `CreateChequeAgentField`
  (Phase 3A) is its OWN component, not a reuse of `ChequeAgentFilter` — a
  filter's `""` is a permanent valid state, a create field's is not. If a
  future screen (the detail page, an action dialog) needs its own agent
  display or picker, make the equivalent explicit call for THAT context —
  do not assume either of the two existing components fits without
  checking, and do not build a third without checking whether one of the
  first two already does.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-N, BC-U, BC-V,
  BC-W, BC-X, BC-Y and the new Deposits/Debt-Payments findings above are
  all standing disclosed limitations, not problems to route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012) —
  Cheques/Deposits/Debt Payments each keep their own, same as every prior
  resource.

## Known follow-ups (carried, unchanged unless noted)

- [x] **M4.1 infrastructure — DONE.** Manually reviewed, validated,
      committed, pushed. See `project-status.md`.
- [x] **M4.2 Phase 1+2 (Cheques: list, read-only) — DONE.**
      Implementation-level reviewed (route-authorization coverage fix, new
      `cheques-list-page.test.tsx`), committed, pushed. See `project-status.md`.
- [x] **M4.2 Phase 3A (Cheques: creation) — DONE.** Backend contract
      verified and corrected before implementation (dropped Bank/Issue
      Date, added the required photo upload), `createCheque`/
      `useCreateChequeMutation` (first real `invalidateForEvent` caller),
      `CreateChequeAgentField`, the Create Cheque page/route,
      `create-cheque-page.test.tsx` (14 tests), committed, pushed. **Full
      manual browser end-to-end validation still pending for BOTH the list
      and create pages.** See `project-status.md`.
- [ ] **M4.2 Phase 3B — NEXT.** Pending queue, detail page. See the plan
      above. Approve/reject/annuler are NOT bundled in by default — confirm
      scope before building them.
- [ ] **M4.2 manual validation, list AND create pages** — run once a real
      session with `create-cheque` is available; the create page can now
      actually produce a real cheque to seed the list/pending-queue/detail
      screens with, unlike every prior verification pass this milestone.
- [ ] **M4.3 Deposits — contingent on the `DepoResource` backend
      consultation.** Do not start until that's raised, or until an
      explicit decision narrows scope around it.
- [ ] **M4.4 Debt Payments — contingent on the placement/permission
      product questions above.**
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 489 tests across 27
      files, stable across two double-runs this session. Recommended
      before Phase 3B's own queue/detail tests add meaningfully more.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking for M4 —
      note Cheques' detail page (Phase 3B) will be this product's first
      real test of whether a nested route is actually needed.
- [ ] **BC-Z, BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S — raise with the
      backend.** Unchanged this session (BC-Z is still open — Phase 3A
      registered two new "verified"/"cleanup" facts instead, see
      `project-status.md`, neither of which needs raising as a blocker).
- [ ] **ADR-0016 owed work** (M3.5's deferred all-pages bulk-assign step) —
      not urgent, not started.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the
      URL-filter-hook question — still the two live decision points.**
      Neither M4.2 Phase 2's list filter nor Phase 3A's create field moved
      the export tally (both merge existing exports, a distinct pattern —
      see `project-status.md`); still unresolved, no new chance to resolve
      it identified yet for Phase 3B.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] M3.1–M3.6, M4.1 and M4.2 Phase 1+2+3A closed out — see `project-status.md`.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
