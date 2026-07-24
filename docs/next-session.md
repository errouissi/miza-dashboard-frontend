# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-25_

---

## Current state

**M3 is complete. M4 (Money) is underway: M4.1 (infrastructure) is
complete and closed out; M4.2 (Cheques) is next, not started.** A full M4
discovery pass (architecture proposal, domain boundaries, API inventory,
business rules, risks, unknowns — across Cheques, Deposits and Debt
Payments, verified from the live backend source) ran before M4.1's
implementation. This file carries forward everything from that pass that
M4.2 actually needs; the rest (Deposits'/Debt Payments' own findings) is
summarized briefly below and re-verified properly when M4.3/M4.4 start.

- **Code**: M4.1 (infrastructure) is committed and pushed. Working tree is
  clean. No Money domain code exists yet — `domains/money/` does not exist.
- **Tests**: 447/447 across 25 files, stable across two standalone
  `pnpm test:ci` runs this session.
- **Quality gates**: typecheck, lint, format:check and build all pass.
- **Documentation**: this file and `project-status.md` are both current as
  of M4.1's close. No new ADR was recorded — M4.1 was pure infrastructure
  extraction with no contract or scope decisions of its own.
- **Commit / push**: both done this session. This file does not
  self-reference the closing commit's own hash — backfilled next session,
  per this project's standing convention (see how `5dd20e8` is recorded for
  M3.6, below).

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M4.1 closure commit at HEAD
pnpm test:ci               # expect: 447/447 across 25 files
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
  **committed and pushed this session, manually reviewed and validated
  first.** Full write-up: `project-status.md`'s M4.1 section.

## Next task: M4.2 — Cheques

**Do not start writing code before presenting a plan and getting approval**
(`session-bootstrap.md` §4 — unchanged). The API inventory and business
rules below are already verified from source (the M4 discovery pass); they
do not need re-verifying from scratch, but re-read `ChequeController.php`
and the `Cheque`/`ChequeAllocation` models directly before writing the
mapper, per this project's standing discipline of reading the controller
before trusting a summary of it.

### Scope (per the discovery pass's recommended order)

List → submit → pending queue (`ApprovalQueuePage`, first instance) →
approve (including the allocation-split sub-form) → reject → annuler →
detail (`DetailPage`, first instance). Cheques go first among the three
M4 resources — richest, best-specified, cleanest single envelope shape
(`{success,message,data}`, the one Money resource that already matches
every Network domain's convention) — the right one to prove
`ApprovalQueuePage`/`DetailPage` against before Deposits (which has its own
backend gap, see below) or Debt Payments (which has its own unresolved
placement question).

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
- **No cross-role agent search endpoint.** `GET /admin/agents/managers`
  and `/commercials` are separate, each capped `per_page ≤ 100` (BC-H). The
  Cheque submit form's `agent_id` picker needs either role and doesn't know
  which — decide whether to merge two async queries into one picker (a
  real, if unusual, `EntityChip`/cross-domain-picker instance — would move
  the picker-export tally to 4) or accept a narrower approach, as an
  explicit, recorded decision, not a default.
- **Query tiers**: Cheques list → `SLOW` or `LIVE` (lean `LIVE` — multiple
  admins may work the pending queue concurrently); Pending queue →
  `LIVE`, `refetchOnWindowFocus: true`; a cheque read inside the approve/
  reject/annuler confirmation → `CRITICAL` (the freshness rule — FTA §8 —
  applies here for the first time in this product: refetch fresh
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
  of the mutation that emits it.** M4.1 shipped it empty on purpose; M4.2
  is where `cheque.approved`/`cheque.rejected`/`cheque.annuled` actually
  get registered, from a real mutation, not speculatively.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties**
  to `index.css` as a side effect of a Cheques screen. `StatusBadge`'s
  M4.1 color implementation (direct Tailwind utilities) was a deliberate,
  scoped choice — revisit it explicitly if it needs to change, don't drift
  into it.
- 🚫 **Do not extract `DataTable`/`FilterBar`/`EntityChip` reflexively**
  just because Cheques adds another paginated, filtered, FK-bearing
  resource. Both tallies are already at or near threshold (see
  `project-status.md`) — this is a real decision point M4.2 may finally
  force, but it should be a deliberate call, not a side effect of "we
  needed a table anyway."
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
- [ ] **M4.2 Cheques — NEXT.** See the plan above. Discovery already done;
      implementation has not started.
- [ ] **M4.3 Deposits — contingent on the `DepoResource` backend
      consultation.** Do not start until that's raised, or until an
      explicit decision narrows scope around it.
- [ ] **M4.4 Debt Payments — contingent on the placement/permission
      product questions above.**
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 447 tests across 25
      files, stable across two double-runs this session. Recommended
      before Cheques' own test file adds meaningfully more.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking for M4.
- [ ] **BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S — raise with the backend.**
      Unchanged.
- [ ] **ADR-0016 owed work** (M3.5's deferred all-pages bulk-assign step) —
      not urgent, not started.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the
      URL-filter-hook question — still the two live decision points.**
      M4.2's own agent-picker design may resolve (or further complicate)
      the first one — see "Known infrastructure risks" above.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] M3.1–M3.6 and M4.1 closed out — see `project-status.md`.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
