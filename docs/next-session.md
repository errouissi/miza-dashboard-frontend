# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-19_

---

## Current focus

**M3.3 — Commercials, plus two follow-up UI fixes, are COMPLETE and COMMITTED**
(not yet pushed — see the commit hash in this session's own summary). The next
milestone is **M3.4 — Clients**.

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers**, plus its live-validation nullability fix — committed as
  `d91d9a2` and `3b84d51`
- **M3.3 Commercials**, plus city-select and multi-city-selector follow-ups —
  implemented, tested and **committed this session** (see the commit hash
  above `## Current focus`)

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean — everything through the follow-ups is committed
git log --oneline -3        # expect the M3.3 commit at HEAD, not yet pushed
pnpm test:ci               # expect: 343/343 across 22 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## What M3.3 shipped

List with server pagination, search, four filters (`status`, `ville_actuelle`,
`manager_id`, `date_from`/`date_to`), edit (four fields: `nom`, `prenom`,
`ville_actuelle`, `num_abonnement`), block/activate, permission gating, and
loading/empty/error states. **No sorting** (BC-L), **no detail page**
(ADR-0014), **no create form** (M3.6), **no secteur filter** (BC-V, deferred —
no options source exists), **no manager-reassignment field** (Agent Transfers'
job, not this form's).

Its contract was verified independently from `AgentController::indexCommercials`
— not inherited from Managers by resemblance. `numAbonnement` and
`villeActuelle` were typed `string | null` from the first draft (both confirmed
nullable against the live dev fixture), closing the exact defect class M3.2
shipped and then had to fix live. A dedicated test pins the null-render/null-hydration
path this time, rather than relying on it being caught after the fact.

**Managers' public surface was extended**, not modified in behavior: a
`useManagerOptionsQuery`/`ManagerOption` export was added (mirroring Villes'
existing picker export) to back Commercials' manager filter, which reads the
real `GET /admin/agents/managers` endpoint. This was the anticipated next step
Managers' own `index.ts` had already flagged when it shipped in M3.2.

**M3.3's own implementation was not verified live** in the session it shipped
in — confirmed by source reading (`AgentController`, the `agents` migration,
the `Secteur` model) and the automated jsdom+MSW suite only. A **later
session did run a live manual-validation pass** (real backend calls, the
seeded admin test accounts) but that pass was investigating the two follow-ups
below, not re-validating M3.3's original list/filter/edit/block/activate
behaviour end to end. If the same live rigor M3.2 received is wanted for
Commercials specifically, that is still outstanding.

## Follow-up 1 — city fields now use the Villes reference select

Manual UI validation found `ville` (Managers) and `ville_actuelle`
(Commercials) as free-text inputs in the edit forms, despite both being
exact-match filters over real city names server-side. Every city-shaped field
across Network was audited before touching anything (`ville`, `ville_actuelle`,
`ville_sous_responsabilite`, and the two list filters that already used
selects). Fixed: both are now `<select>`s sourced from `useVilleOptionsQuery`
(reused, unchanged), sending the city's **name**, verified from source to be
what the backend has always expected — no id, no contract change.
`useVilleOptionsQuery` gained an optional `enabled` param (backward
compatible) so the always-mounted edit forms can gate the query on
`access-dashboard` the same way the list filters already do. A value absent
from the fetched options is never dropped — rendered as an extra, honestly
labelled option, asserted "not in the reference list" only once the options
have actually resolved.

`ville_sous_responsabilite` was deliberately left as free text in this first
pass — see Follow-up 2, which superseded that decision.

## Follow-up 2 — Area of responsibility is a multi-city selector

The business rule was clarified: a manager may be responsible for **multiple**
cities. **The backend contract is unchanged** — verified from source before
writing anything (see **ADR-0015**): `ville_sous_responsabilite` is a plain
`string`, `nullable()` column, no cast, validated `nullable|string|max:255`
everywhere, filtered by substring `LIKE`, and the only sample value anywhere
in the codebase is a single bare name. **The backend has no multi-value
convention of its own** — ADR-0015 introduces one, entirely frontend-side:
`", "`-joined city names inside that same single string.

UI: a trigger button ("N cities selected") discloses a checkbox panel
(`ManagerAreaMultiSelect`, `manager-area-multiselect.tsx`) built from plain
native `<input type="checkbox">` — not Radix's `DropdownMenuCheckboxItem`,
which portals outside `within(dialog)`'s scope and would fight every test.
Selected cities show as removable chips with their own sibling `<button>`
(never nested inside the trigger). Legacy values absent from Villes stay
selected and visible until explicitly unchecked.

**A real bug was found and fixed mid-implementation**: normalisation
(trim/dedupe/order) only ran when the operator touched a checkbox, so an
untouched malformed legacy value (e.g. an accidental duplicate) would have
been resubmitted unchanged — a new test caught this. Fixed by normalising the
moment the form opens, not only on interaction.

## Follow-up investigation — Block/Activate visibility, no code defect found

Manual UI validation reported Edit-only visibility (no Block/Activate) for
`superadmin@test.com` on both Managers and Commercials. Investigated fully:
backend confirmed live to return `block-agent`/`activate-agent` correctly
(both `/auth/login` and `/me`); the frontend's permission check is
structurally identical to the working `update-agent` check; the automated
suite already asserts both actions render correctly for a session holding
these permissions. **No frontend defect found or fixed.**

Most likely explanation: a **stale cached session** in the browser's
`localStorage`, predating when `block-agent` was seeded server-side.
**Per ADR-0003, the app never refreshes permissions after login** — this is
deliberate, not a bug, and was not touched. **Operationally important going
forward: whenever a permission is newly seeded or corrected on the backend,
any operator already logged in will not see the effect until they log out and
back in.** This applies to any future permission change, not just this one.

## Next task — M3.4 Clients

The fourth Network domain. **Its contract has not been verified in this
session — verify it before implementing**, per the same discipline that caught
M3.2's and M3.3's own contract surprises.

What is already known from this session's discovery, and what it implies:

- `AgentController::getAgentSubData` (already read from source) returns a
  commercial's clients when called on a commercial id — but that is a
  **sub-resource of an agent**, not necessarily the same shape or scope as a
  standalone Clients domain. Do not assume `GET /admin/agents/{id}/sub-data` is
  the Clients list endpoint without checking whether a dedicated
  `/admin/clients` (or similar) route exists.
- Client-management permissions already exist and are seeded
  (`view-clients`, `view-client-stats`, `create-client`, `update-client`,
  `delete-client`, `manage-client-status`, `assign-client`,
  `reset-client-password`) — none of them registered in the frontend registry
  yet. Confirm which ones a Clients list actually needs before registering any.
- Client bulk-assign is its own later milestone (M3.5) — do not pull it forward.
- Re-run the same nullability discipline as M3.2/M3.3: check the `clients`
  migration column-by-column before typing anything, rather than trusting a
  field's name or a fixture's completeness.

Copy the structure of `src/domains/network/commercials/` as the newest
comparable resource, but re-verify the contract independently — the same
warning given (and honored) for M3.3 applies again.

## Backend findings from M3.3

- **BC-V** 🟡 **limitation, new.** `agents.secteur` has no foreign key to
  `secteurs` and is filtered by exact match; the dev database has zero seeded
  secteurs and no options source exists. No secteur filter was built. **Do not
  invent a distinct-values endpoint.**
- **BC-S** 🟡 **limitation, now a two-instance class.** Managers' `ville` and
  Commercials' `ville_actuelle` share the identical free-text-column-behind-an-
  exact-match-filter trap.
- **BC-H** 🟡 **limitation, now exercised twice.** Both Managers' city filter
  and Commercials' manager filter read picker sources bounded at
  `per_page=100`. Only 1 manager and 1 commercial exist in the dev database, so
  this stays invisible until scale.
- BC-N/O/P/L were independently re-confirmed against `indexCommercials` (not
  assumed from Managers) — all four apply identically. See `project-status.md`.

## Known follow-ups

- [ ] **FE-1 — test flake, not touched this session.** Five older test files'
      `findByRole("alert")` calls still run against the 1000 ms default while
      taking 951–1240 ms. Recommended before the suite grows further — it now
      has 45 more tests in it than when this was last raised.
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking, M3.3 ships
      no nested route either.
- [ ] **BC-U — raise with the backend.** `nullable` missing from the `update()`
      validator for `num_d_abonnement`/`ville`. Unaffected by M3.3 (Commercials
      never sends `ville`, and its own three commercial-specific fields are
      all correctly nullable in the validator).
- [ ] **BC-V — raise with the backend, or seed secteurs first.** See above.
- [ ] **BC-S — raise with the backend.** Now spans two columns (`ville`,
      `ville_actuelle`).
- [ ] **The ADR-0006 wording question, still unresolved.** ADR-0006 phrases the
      URL-filter hook's threshold as "a resource with **3+ filters**" — a
      per-resource bar Managers already met at M3.2 — while its five sibling
      thresholds are all cross-resource "3 [resources]" counts. Flagged during
      M3.3 planning, not resolved. The decision given for M3.3 was to defer
      **all** shared extractions together until after Commercials, which this
      milestone now is — so this question is due for a decision, not further
      deferral, the next time shared extraction comes up.
- [ ] **Rule-of-Three tally after M3.3** (see `project-status.md` for the full
      table): `DataTable`/`FilterBar` now read as satisfied under the
      cross-resource-count interpretation (3 paginated/filtered resources:
      Villes, Managers, Commercials). `StatusBadge` needs Clients for its
      third enum. `MoneyAmount`'s evidence is muddied, not accumulating — see
      the note in `project-status.md`. Nothing was extracted this session;
      this is a recorded tally, not a decision.
- [ ] **M3.3's own list/filter/edit/block/activate behaviour has not had a
      full live manual-validation pass**, unlike M3.2. A later session did run
      live checks, but for the two follow-ups below, not this. If the same
      end-to-end rigor M3.2 received is wanted for Commercials, it is still
      outstanding.
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] **Money representation — unchanged, still correct.** Commercials'
      `avanceTotal` follows the identical verbatim-string rule as Managers'.
- [x] **M3.3 nullability — modelled correctly from the first draft.** See above.
- [x] **City fields now use Villes-backed selects** (Follow-up 1) — `ville`
      (Managers), `ville_actuelle` (Commercials). Payload is still the city
      name, not an id; verified from source.
- [x] **Area of responsibility is a Villes-backed multi-city selector**
      (Follow-up 2, ADR-0015) — backend contract unchanged, `", "`-joined
      encoding is frontend-only.
- [x] **Block/Activate visibility investigated — no frontend defect.**
      Session-permission caching (ADR-0003) is the likely cause of what was
      observed; a fresh login is the fix, not a code change. See above.

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, unmodified across
  **six** resources now. `ListPage` must **never** own table rendering.
- 🚫 **Do not extract** `DataTable`, `FilterBar`, `StatusBadge`, `MoneyAmount`,
  `EntityChip`, the resource-definition module, or a URL-filter hook **without
  revisiting the tally in `project-status.md` first** — some of these now read
  as evidenced under one plausible reading of ADR-0006, and that reading has
  not been decided.
- 🚫 **Do not add sorting to Managers or Commercials.** Neither endpoint
  accepts a sort parameter of any kind (BC-L).
- 🚫 **Do not "fix" the case-sensitive search placeholder or the "Joined
  before" label**, on either Managers or Commercials. Both describe real
  backend behaviour (BC-O, BC-P).
- 🚫 **Do not parse `avanceTotal`** on either domain. It is a `bcadd` string,
  deliberately, on both.
- 🚫 **Do not add a secteur filter to Commercials** without first seeding real
  secteurs and building an options source (BC-V). A control with nothing to
  select misrepresents the system.
- 🚫 **Do not add a manager field to the Commercials edit form.** Reassignment
  is the Agent Transfers feature (existing backend infrastructure, zero
  frontend footprint), guarded by `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`, not a
  plain field edit.
- 🚫 **Do not revert `ville`/`ville_actuelle` to free-text inputs, and do not
  add a new one for any other city field.** Verified from source: both are
  exact-match filters over a real Villes name; a select is what the contract
  supports (Follow-up 1).
- 🚫 **Do not send `ville_sous_responsabilite` as an array, or assume the
  backend accepts one.** ADR-0015: it is still a single `string`, validated
  `nullable|string|max:255` everywhere. The `", "`-joined multi-city encoding
  is a **frontend-only** convention layered on an unchanged contract — reuse
  it for any future field with the same shape rather than inventing a second
  convention.
- 🚫 **Do not add a boot-time `/me` permission refresh** to "fix" stale
  session permissions. ADR-0003 forbids this deliberately; the Block/Activate
  investigation confirmed the code is correct and the fix (if the symptom
  recurs) is a fresh login, not a new refresh mechanism.
- 🚫 **Do not modify existing tests** to accommodate an implementation. If a
  test needs a behavioural change, stop and explain first.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-U and BC-V are four
  standing examples of disclosed limitations, not problems to route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012).
  Commercials has its own mapper and key factory, not shared with Managers,
  despite both reading the identical envelope shape.
- 🚫 **Do not assume a field is non-nullable because every fixture so far has
  had one.** Check the migration column-by-column, every time — this is now
  the second domain where it mattered.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
