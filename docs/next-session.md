# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-23_

---

## Current focus

**M3.5 — Client bulk-assign is COMPLETE, manually validated, committed and
pushed this session** (frontend; see the commit hash in this session's own
summary). **No backend changes were needed or made this session.** **M3
(Network / identity graph) has now shipped all five of its named
deliverables — Admins, Managers, Commercials, Clients, and Client
bulk-assign.** The next milestone is **M3.6 — Agent onboarding wizard. Not
started.**

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers**, plus its live-validation nullability fix — committed as
  `d91d9a2` and `3b84d51`
- **M3.3 Commercials**, plus city-select and multi-city-selector follow-ups —
  committed as `700d99f`
- **M3.4 Clients** — committed as `eaaa78b`
- **M3.5 Client bulk-assign** — implemented, tested, manually validated end
  to end against the real backend, and **committed and pushed this session**
  (see the commit hash in this session's own summary)

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M3.5 commit at HEAD, pushed
pnpm test:ci               # expect: 407/407 across 23 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## What M3.5 shipped

Current-page row selection (checkbox column), current-page select-all
(indeterminate for partial), a bulk action bar (count, "Clear selection",
"Assign to commercial"), a dedicated `ClientBulkAssignSheet` (built on the
existing `FormDrawer`, not a repurposed `ConfirmActionDialog`), a new
active-only Commercials picker (`useCommercialOptionsQuery`/
`CommercialOption`), `ASSIGN_CLIENT` permission gating (fail-closed), the
`assignClientsBulk`/`useAssignClientsBulkMutation` mutation against `PATCH
/admin/clients/assign-bulk`, selection-reset rules (cleared on every
page/page-size/search/status/assigned/city change, never persisted across
pages), success invalidation + selection clearing, and field/generic error
handling for the two distinct 422 shapes `assignBulk` can return.

**Explicitly deferred, by decision, not by contract necessity** (see
`project-status.md`'s M3.5 section for the full reasoning): single-client
Assign, Reassign, Unassign; Create Client; Delete Client; Reset Password;
Statistics; a detail page (ADR-0014, unchanged).

**A real deviation from two frozen documents was found and recorded, not
silently dropped — see ADR-0016.** The roadmap's M3 deliverables and Design
System §14 both name an "all-pages selection, deliberate second step" and a
"100 max" count surfaced in the bulk action bar as part of Client
bulk-assign. M3.5 ships current-page-only selection, given as an explicit
scope instruction, with neither of those. ADR-0016 explains why this is
**not** the same gap as "select all matching filters" (correctly ruled out
as unbuildable against today's contract — no backend endpoint accepts a
filter object, only explicit `client_ids`) — the frozen "all-pages" step is
a **client-side, walk-every-page-and-union-ids** capability, genuinely
buildable today, just not built this session. **A future discovery pass
must cross-check the frozen roadmap's milestone section AND the relevant
Design System section(s), not only the backend contract, before scope is
fixed** — this is the actual process gap M3.5 exposed, independent of the
specific feature.

Contract findings, verified from source, not assumed: `assignBulk`/
`reassign` are the first Clients endpoints that correctly catch
`ValidationException` before their generic handler (BC-N does not extend to
them). Their business-rule rejection ("agent_id must reference an active
commercial", "some clients do not exist") is a separate, hand-rolled
`{success:false, message}` 422 with no `errors` key and no `code` — new
finding **BC-X**, non-blocking, recorded below.

## Backend findings from M3.5

- **BC-X** 🟡 **limitation, new.** `assignBulk`'s (and `reassign`'s)
  business-rule rejection carries no `code`, unlike the product's own coded
  domain-error convention elsewhere (e.g. `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`).
  Normalizes to `kind: "unknown"`; the frontend shows a generic error, which
  is honest but not specific. Non-blocking.
- No new defects. `assignBulk`/`reassign` are, notably, the **first** Clients
  endpoints found NOT to have the BC-N swallowed-validation-exception defect.

See `project-status.md` for the full M3.5 write-up, including everything
deliberately not modelled and why.

## Known follow-ups

- [ ] **FE-1 — test flake, not touched this session.** Five older test
      files' `findByRole("alert")` calls still run against the 1000 ms
      default while taking 951–1240 ms. One interleaved run this session hit
      it on five unrelated files under heavier machine load (confirmed
      flake, not a regression, by two clean standalone reruns). Recommended
      before the suite grows further — now at 407 tests, 19 more than when
      this was last raised.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking. M3.5
      contributes no nested route either (it extends the existing Clients
      list route in place), so this stays dormant until the first detail
      page is built.
- [ ] **BC-X — raise with the backend, new this session.** See above.
- [ ] **BC-N — raise with the backend.** Unchanged — confirmed on three
      controllers (`indexManagers`/`update`, `indexCommercials`/`update`,
      `ClientController::update`), and now confirmed **absent** from
      `assignBulk`/`reassign` specifically — worth noting both facts if
      this is ever raised as one ticket.
- [ ] **BC-U — raise with the backend.** Unchanged from M3.4.
- [ ] **BC-V — raise with the backend, or seed secteurs first.** Unchanged.
- [ ] **BC-S — raise with the backend.** Unchanged.
- [ ] **ADR-0016 owed work — not urgent, not started.** The frozen
      "all-pages, deliberate second step" selection action and the "100 max"
      count copy in the bulk action bar remain unbuilt. Pick this up only on
      an explicit product ask — it is scope, not a defect.
- [ ] **Rule-of-Three / shared-extraction decision — still due, still not
      resolved.** M3.5 touched no shared component (row selection and the
      bulk action bar are the FIRST instance of that pattern; the
      cross-domain picker export is now at its SECOND instance via
      Commercials → Clients). The M3.4-era tally (`DataTable`/`FilterBar` at
      "3", `StatusBadge`/`MoneyAmount` ambiguous even at "3") is unchanged
      and still the next actual decision point — see `project-status.md`.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] **M3.5 Client bulk-assign — complete, tested, manually validated.**
      See above and `project-status.md`.
- [x] Everything M3.1–M3.4 and their follow-ups closed out — see
      `project-status.md`, unchanged this session.

## Next task — M3.6 Agent onboarding wizard

**Not started. Do not begin implementation without a fresh discovery
pass**, per the same discipline every prior M3 sub-milestone required —
assume nothing about the wizard's field set, upload handling, or validation
from having built the four list screens.

What the frozen roadmap already names (read the actual sections before
trusting this summary — this is a pointer, not a substitute for the
discovery pass):

- `phase8-frontend-implementation-roadmap.html`'s M3 section names
  **`CreateWizard`** — agent onboarding, described as "the only wizard in
  the product" (FTA D-9), with multi-file upload via named slots (Design
  System §12), ~20 required fields, conditional by role, and an explicit
  risk callout: it is "the first form complex enough to hurt" and the first
  real test of FTA §10's rule that "a lost connection MUST NOT cost a
  filled wizard its data."
- Exit criteria named in the same section: an agent onboarded end to end
  with documents against the real backend; a network failure at the
  wizard's final step loses nothing; the entity picker (`EntityChip`, also
  named as an M3 deliverable and still at "0" evidence per the Rule-of-Three
  tally) is used everywhere a foreign key is chosen, no raw ID entry
  anywhere.
- **This session's own process gap (see ADR-0016) applies directly here:**
  read Design System §12 (multi-file upload with named slots) and FTA §10
  (the no-data-loss rule) in full before scoping anything — do not repeat
  M3.5's mistake of fixing scope from the backend contract alone.
- Verify from source: does `create-agent`/the relevant store endpoint
  actually accept role-conditional fields and file uploads today, or is
  there a backend gap to raise first? Do not assume the `AgentController`
  store path matches the wizard's ~20-field description without reading it.

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, unmodified
  across **eight** call sites now (Clients' M3.5 bulk-assign sheet reuses
  `FormDrawer` unchanged). `ListPage` must **never** own table rendering.
- 🚫 **Do not extract** `DataTable`, `FilterBar`, `StatusBadge`,
  `MoneyAmount`, `EntityChip`, the resource-definition module, a
  URL-filter hook, row selection, or the cross-domain picker-export pattern
  **without first making the still-due Rule-of-Three decision** recorded in
  `project-status.md`. Row selection is at "1" instance, the picker-export
  pattern at "2" — neither is close.
- 🚫 **Do not add sorting to Managers, Commercials or Clients.** Unchanged.
- 🚫 **Do not "fix" the case-sensitive search placeholder or the "Joined
  before" label** on Managers or Commercials. Unchanged. Clients still has
  no date filter — do not add one.
- 🚫 **Do not parse `avanceTotal`** (Managers/Commercials) or **`solde`**
  (Clients). Unchanged.
- 🚫 **Do not add a secteur filter to Commercials** without first seeding
  real secteurs and building an options source (BC-V). Unchanged.
- 🚫 **Do not add a manager field to the Commercials edit form.** Unchanged.
- 🚫 **Do not revert `ville`/`ville_actuelle`/`ville_comercial` to free-text
  inputs.** Unchanged.
- 🚫 **Do not send `ville_sous_responsabilite` as an array.** ADR-0015,
  unchanged.
- 🚫 **Do not build a second block/activate dialog pattern for Clients.**
  Unchanged.
- 🚫 **Do not assume `agent_id = 2` (or any other hardcoded agent id)
  anywhere.** Unchanged.
- 🚫 **Do not register `DevClientSeeder` in `DatabaseSeeder`.** Unchanged.
- 🚫 **Do not add a boot-time `/me` permission refresh.** ADR-0003, unchanged.
- 🚫 **Do not modify existing tests** to accommodate an implementation
  without stopping to explain first. (M3.5's one exception — narrowing the
  "never offers assign/bulk-assign" test once bulk-assign became real,
  approved scope — was explained inline in `project-status.md`, not silent.)
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-N, BC-U, BC-V, BC-W
  and BC-X are all standing examples of disclosed limitations, not problems
  to route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012).
- 🚫 **Do not assume a field is non-nullable because every fixture so far
  has had one.** Check the migration column-by-column, every time.
- 🚫 **Do not add Create Client, Delete Client, Reset Password, Statistics,
  a detail page, map-editing, or single-client assign/reassign/unassign UI
  to Clients without a fresh scope approval.** All remain explicitly
  deferred by decision, not by contract necessity.
- 🚫 **Do not silently drop a capability a frozen document names without
  recording it (ADR-0016's own lesson).** If a scope decision narrows what
  the roadmap or Design System describes, record why, not just what.
- 🚫 **Do not fix scope for M3.6 (or any milestone) from the backend
  contract alone.** Read the relevant frozen Design System section(s) too —
  this is the concrete process fix ADR-0016 asks for.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
