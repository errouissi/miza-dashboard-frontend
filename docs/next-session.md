# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-25_

---

## Current state

**M3 is complete. M4 (Money) is underway: M4.1 (infrastructure) is complete;
M4.2 (Cheques) Phase 1 (domain model, API, queries) and Phase 2
(permissions, routing, list page, DataTable/FilterBar extraction) are both
complete, implementation-level reviewed, and closed out. M4.2 Phase 3
(submit, pending queue, approve incl. allocation split, reject, annuler,
detail page) is next, not started.** A full M4 discovery pass (architecture
proposal, domain boundaries, API inventory, business rules, risks, unknowns
— across Cheques, Deposits and Debt Payments, verified from the live
backend source) ran before M4.1's implementation. The API inventory and
business rules below are unchanged from that pass and still the source for
Phase 3; the rest (Deposits'/Debt Payments' own findings) is summarized
briefly further down and re-verified properly when M4.3/M4.4 start.

- **Code**: M4.1 (infrastructure) and M4.2 Phase 1+2 (Cheques: model, API,
  queries, permissions, routing, list page) are committed and pushed.
  Working tree is clean. `domains/money/cheques/` exists — list only, no
  mutations, no submit form, no pending queue, no approve/reject/annuler, no
  detail page.
- **Tests**: 473/473 across 26 files, stable across two standalone
  `pnpm test:ci` runs this session.
- **Quality gates**: typecheck, lint, format:check and build all pass.
- **Documentation**: this file and `project-status.md` are both current as
  of M4.2 Phase 2's close. No new ADR was recorded — the DataTable/FilterBar
  extraction was an explicit, asked-and-answered scope decision (recorded in
  `project-status.md`'s M4.2 section), not a contract change.
- **Manual validation status — genuinely incomplete, not just untested**:
  there is currently no way to create a cheque through the UI (Phase 3
  builds the submit form) or seed one in the dev database, so the list page
  has only been implementation-level verified (a dedicated MSW-integration
  test file, a route-authorization coverage fix, a full file-by-file
  review) — never exercised against the real running backend in a browser.
  **Do this once Phase 3's submit form exists and at least one real cheque
  can be created.**
- **Commit / push**: both done this session. This file does not
  self-reference the closing commit's own hash — backfilled next session,
  per this project's standing convention (see how `5dd20e8` is recorded for
  M3.6, below).

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M4.2 Phase 1+2 closure commit at HEAD
pnpm test:ci               # expect: 473/473 across 26 files
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
  — **committed and pushed this session, implementation-level reviewed
  first (full manual browser validation still pending, see "Current state"
  above).** Full write-up: `project-status.md`'s M4.2 section.

## Next task: M4.2 Phase 3 — Cheques mutations + detail page

**Do not start writing code before presenting a plan and getting approval**
(`session-bootstrap.md` §4 — unchanged). The API inventory and business
rules below are already verified from source (the M4 discovery pass, plus
Phase 1/2's own re-verification); they do not need re-verifying from
scratch, but re-read `ChequeController.php` and the `Cheque`/
`ChequeAllocation` models directly before writing the submit/approve/
reject/annuler mutations, per this project's standing discipline of reading
the controller before trusting a summary of it.

### Scope (per the discovery pass's recommended order — list is now done)

Submit → pending queue (`ApprovalQueuePage`, first instance) → approve
(including the allocation-split sub-form) → reject → annuler → detail
(`DetailPage`, first instance). Cheques go first among the three M4
resources — richest, best-specified, cleanest single envelope shape
(`{success,message,data}`, the one Money resource that already matches
every Network domain's convention) — the right one to prove
`ApprovalQueuePage`/`DetailPage` against before Deposits (which has its own
backend gap, see below) or Debt Payments (which has its own unresolved
placement question).

**Before writing the submit form's agent picker**: decide explicitly
whether to reuse Phase 2's `ChequeAgentFilter` merge pattern
(`useManagerOptionsQuery` + `useCommercialOptionsQuery` combined into one
`<select>`) or something else — do not silently copy it without re-deriving
whether the submit form's constraints (a required, not optional, selection;
a create rather than a filter context) actually match. `BC-Z` (below) also
blocks a correct "processed by" field on the detail page until raised with
the backend — do not guess at a value for it.

### API inventory (verified from source)

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| POST | `/admin/cheques` | `create-cheque` | multipart; `photo_cheque` required image ≤2MB |
| GET | `/admin/cheques` | `view-cheques` | filters: `statute` (`en_attente/accepter/rejetee/annuler`), `agent_id`, `date_from`, `date_to`, `search` (num_cheque only), `per_page` (max 100) |
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

### The invalidation map's first real entries (M4.2 populates `invalidation-map.ts`)

`cheque.approved`/`cheque.annuled` write `agent.montant_avance_rapped`/
`montant_avance_grattage` — the SAME columns Managers'/Commercials' list
already renders as `avanceTotal`. Register:

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

- **`ConfirmActionDialog` is hardcoded `variant="destructive"`.** Approving
  a cheque is not a destructive action visually — needs a `variant` prop
  or a sibling component before Approve/build. Reject/Annuler fit the
  existing destructive styling fine.
- **No cross-role agent search endpoint** — unchanged fact, but Phase 2
  already built one instance of the merge decision: `ChequeAgentFilter`
  combines `useManagerOptionsQuery` + `useCommercialOptionsQuery` into one
  `<select>` for the LIST's read-only filter. **Do not assume the submit
  form's required `agent_id` picker should silently reuse it as-is** — a
  filter (optional, "all agents" is a valid state) and a create field
  (required, must resolve to a real id) are different constraints; re-derive
  the decision for this specific case, per the note under "Scope" above.
- **Query tiers**: Cheques list is **already `LIVE`, `refetchOnWindowFocus:
  true`, done at Phase 1** (FTA §8 names pending cheques explicitly under
  this tier, and the plain list is the same class of concurrently-edited
  data — not a "lean LIVE" open question anymore). Pending queue →
  `LIVE`, `refetchOnWindowFocus: true`, same tier; a cheque read inside the
  approve/reject/annuler confirmation → `CRITICAL` (the freshness rule — FTA
  §8 — applies here for the first time in this product: refetch fresh
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
  of the mutation that emits it.** M4.1 shipped it empty on purpose;
  Phase 3 is where `cheque.approved`/`cheque.rejected`/`cheque.annuled`
  actually get registered, from a real mutation, not speculatively. The
  exact entries to register (invalidating `['cheques']` — flat, per Phase
  1's own key-shape decision — plus both Network prefixes) are already
  spelled out above; do not re-derive from scratch, but do re-verify the
  key shape is still `["cheques", ...]` before writing them.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties**
  to `index.css` as a side effect of a Cheques screen. `StatusBadge`'s
  M4.1 color implementation (direct Tailwind utilities) was a deliberate,
  scoped choice — revisit it explicitly if it needs to change, don't drift
  into it.
- 🚫 **`DataTable`/`FilterBar` are now real, extracted shared components
  (M4.2 Phase 2)** — consumed by Cheques' list page only. **Do not
  retrofit Villes/Managers/Commercials/Clients onto them** as a side effect
  of Phase 3 work; that migration is separate, larger, and was explicitly
  out of scope when the extraction happened. `EntityChip` and the
  URL-filter hook remain genuinely unextracted — do not build either
  reflexively either.
- 🚫 **Do not silently reuse `ChequeAgentFilter`'s merge pattern for the
  submit form's required `agent_id` field** without re-deriving whether it
  fits — see "Known infrastructure risks" above.
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
      `cheques-list-page.test.tsx`), committed, pushed. **Full manual
      browser end-to-end validation still pending** — no way to create a
      cheque yet. See `project-status.md`.
- [ ] **M4.2 Phase 3 — NEXT.** Submit, pending queue, approve (allocation
      split), reject, annuler, detail page. See the plan above.
- [ ] **M4.2 list page manual validation** — run once Phase 3's submit form
      exists and at least one real cheque can be created/seeded.
- [ ] **M4.3 Deposits — contingent on the `DepoResource` backend
      consultation.** Do not start until that's raised, or until an
      explicit decision narrows scope around it.
- [ ] **M4.4 Debt Payments — contingent on the placement/permission
      product questions above.**
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 473 tests across 26
      files, stable across two double-runs this session. Recommended
      before Phase 3's own mutation tests add meaningfully more.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking for M4 —
      note Cheques' detail page (Phase 3) will be this product's first
      real test of whether a nested route is actually needed.
- [ ] **BC-Z, BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S — raise with the
      backend.** BC-Z is new this session (M4.2 Phase 1, `show()`'s
      `processed_by` relation bug) — see `project-status.md`.
- [ ] **ADR-0016 owed work** (M3.5's deferred all-pages bulk-assign step) —
      not urgent, not started.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the
      URL-filter-hook question — still the two live decision points.**
      M4.2 Phase 2's agent filter did **not** move the export tally (it
      merges existing exports, a distinct pattern — see
      `project-status.md`); Phase 3's submit-form picker is the next real
      chance to resolve it.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] M3.1–M3.6, M4.1 and M4.2 Phase 1+2 closed out — see `project-status.md`.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
