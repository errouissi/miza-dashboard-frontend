# Project Status

**The current state of the project.** Overwrite this file after every completed
milestone — it describes *now*, not history. History lives in `decisions.md` and git.

_Last updated: 2026-07-19_

---

## Current milestone

**M3 — Network / identity graph.** M3.1 (Admins), M3.2 (Managers) and **M3.3
(Commercials) complete**; **M3.4 (Clients) is next.**

## Current branch

`main` at `3b84d51` — **level with `origin/main`**. M3.2's implementation
(`d91d9a2`) and its live-validation nullability fix (`3b84d51`) are both committed
and pushed. **M3.3 and its two follow-up UI fixes are approved and about to be
committed together**: 13 new files under `src/domains/network/commercials/` and
`manager-area-multiselect.tsx`, plus the modified files listed below.

## Last completed implementation

**M3.3 — Commercials.** The third Network domain, contract-verified independently
from source (`AgentController::indexCommercials`) rather than inherited from
Managers by resemblance — the planning pass's own discovery found the two
domains' row shapes, editable-field sets and filter semantics all differ in ways
that would have been missed by copying without re-verifying.

Delivered: server pagination, search, four filters (`status`, `ville_actuelle`,
`manager_id`, `date_from`/`date_to`), edit (four fields only — `nom`, `prenom`,
`ville_actuelle`, `num_abonnement`), block/activate, permission gating, and
loading/empty/error states. **No sorting** (BC-L), **no detail page** (ADR-0014),
**no create form** (M3.6), **no secteur filter** (deferred — see below), **no
manager-reassignment field** (out of scope — see below).

**Modelled correctly from the first draft, not discovered afterward:**
`numAbonnement` and `villeActuelle` are both `nullable()` columns, confirmed
against the live dev fixture (`num_abonnement: null` on the one seeded
commercial). Both are typed `string | null` throughout, the edit form seeds
`?? ""`, and the list renders `?? ABSENT` — the exact defect class M3.2 shipped
and then had to fix live is absent here by design, and a dedicated test pins it.

**Two scope decisions, given and implemented exactly as decided, not derived
during implementation:**

- **The manager filter is built against the real backend endpoint**
  (`GET /admin/agents/managers`), not deferred. Verified from source that both
  `indexCommercials` and `indexManagers` share the identical `view-agents`
  permission, so — unlike the city filter — the manager filter needs no
  conditional mount; any operator who can reach this page can always resolve it.
  This required extending Managers' own public surface with a
  `useManagerOptionsQuery`/`ManagerOption` export (mirroring how Villes already
  exposes `useVilleOptionsQuery` to Managers), which Managers' own `index.ts` had
  already flagged as the anticipated next step for exactly this caller. BC-H
  (bounded at `per_page=100`) applies and is documented, not worked around.
- **The secteur filter is deferred, not built.** `agents.secteur` has no foreign
  key to `secteurs` (confirmed: the `Secteur` model has no relation back to
  `Agent`), the filter would be exact-match only, and the dev database currently
  has **zero** seeded secteurs — there is no options source to build a select
  from, and a free-text box over an exact-match filter would be a control that
  appears to work and does not (ADR-0009). Recorded as **BC-V** below. A test
  pins that no secteur filter or column exists anywhere on the page.

**Manager reassignment was kept out of the edit form, on converging evidence,
not a guess:** the list row exposes only a concatenated `"{nom} {prenom}"`
display string for the manager, never an id, so there is nothing to seed a
picker's selection from; the backend guards reassignment with a real business
rule (blocked with `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN` while the commercial
holds grattage stock); and the frozen architecture names **"Agent Transfers
(Manager → Commercial)"** as its own roadmap item, with full backend
infrastructure already built (`AgentTransferPermissions`, an `AgentTransfer`
model, seven dedicated feature-test files) and zero frontend footprint. A test
pins that no manager field appears in the drawer.

**BC-N, BC-O, BC-P and BC-L were independently confirmed to apply to
`indexCommercials`** (not assumed from Managers): same swallowed-`ValidationException`
pattern, same case-sensitive `LIKE` search, same uncast `date_ajout <=`
comparison, same absence of any sort parameter. All four are handled by the
identical disclosure pattern Managers already established — re-verified, not
copied blind.

**BC-S's limitation class now has a second instance:** `ville_actuelle` carries
the same free-text-column-behind-an-exact-match-filter trap as Managers' `ville`.
The city filter is a select over the Villes reference set, same as Managers',
same disclosed limitation.

## Follow-up 1 — city fields now use the Villes reference select

Manual UI validation found free-text city inputs in both edit forms. Audited
every city-shaped field across Network (`ville`, `ville_actuelle`,
`ville_sous_responsabilite`, and the two list filters that already used
selects) before touching anything:

- **`ville` (Managers edit)** and **`ville_actuelle` (Commercials edit)** are
  now `<select>`s sourced from `useVilleOptionsQuery` (Villes' existing public
  surface, reused unchanged) — not free text. Both are exact-match filters
  server-side and real city names, confirmed from `AgentController`, so a
  select is what the contract actually supports. **The payload is still the
  city's NAME, not a Villes id** — verified from source (`agents.ville`/
  `ville_actuelle` are plain string columns, no FK), not guessed, and matches
  what the list filters already send.
- **`ville_sous_responsabilite` (Managers edit) deliberately did NOT get a
  single select** in this first pass — see Follow-up 2, which superseded it
  with a multi-select once the business rule was clarified.
- `useVilleOptionsQuery` gained an optional `enabled` parameter (backward
  compatible; existing callers unaffected) so the edit forms — which are
  always mounted regardless of `open` (`FormDrawer` owns only the shell) — can
  gate the query on `access-dashboard` exactly as the list filters already do,
  rather than firing an unauthorized request for every operator regardless of
  permission.
- **Legacy values absent from the Villes options are never silently
  dropped**: an extra, honestly-labelled option is rendered and stays
  selected until the operator explicitly changes it — asserted only once the
  options have actually resolved, never while loading or permission-gated.
- List filters (`ManagerVilleFilter`, `CommercialVilleFilter`) were verified
  unchanged and correct — this follow-up touched only the edit forms.

## Follow-up 2 — Area of responsibility is a Villes-backed multi-city selector

The business rule was clarified further: a manager may be responsible for
**multiple** cities, not one — superseding Follow-up 1's decision to leave
`ville_sous_responsabilite` as free text.

**The backend contract is unchanged**, verified from source before writing
any code, not guessed: `agents.ville_sous_responsabilite` is a plain `string`,
`nullable()` column, no cast, no accessor; every validator (`store()`,
`update()`, the list filter) is `nullable|string|max:255`, never `array`; the
list filter does a substring `LIKE` match over that one string; and the only
sample value anywhere in the codebase is a single bare name. **The backend has
no multi-value convention of its own.**

**ADR-0015 records the decision made here**: multiple cities are encoded as
`", "`-joined names within that same single string — a **frontend-only**
convention over an **unchanged backend contract**. Same endpoint, same field
name, same payload type (a string, asserted by a dedicated test), no
migration, no array ever sent.

UI: the free-text input became a trigger button ("N cities selected" / "Select
cities") that discloses a checkbox panel on click — native
`<input type="checkbox">`, not a new shared abstraction (Radix's
`DropdownMenuCheckboxItem` was considered and rejected: it portals outside
`within(dialog)`'s scope, which would fight every test rather than let it test
behaviour). Selected cities render as removable chips, each with its own
sibling `<button>` (never nested inside the trigger — invalid HTML). Reuses
`useVilleOptionsQuery` unchanged.

**A real gap was found and fixed during this pass**: normalisation (trim,
de-duplicate, preserve order) only ran once the operator touched a checkbox —
an untouched malformed legacy value (e.g. an accidental duplicate) would have
been resubmitted unchanged, which a new test caught. Fixed by normalising the
moment the form opens, not only on interaction.

## Follow-up investigation — Block/Activate visibility, no code defect found

Manual UI validation reported Managers/Commercials showing Edit only, missing
Block/Activate for `superadmin@test.com`. Investigated end to end:

- **Backend confirmed correct, live**: both `/auth/login` and `/me` return
  `block-agent` and `activate-agent` for that account right now.
- **Frontend permission-check code confirmed correct**: `has(PERMISSIONS.BLOCK_AGENT)`
  is structurally identical to the working `has(PERMISSIONS.UPDATE_AGENT)`
  check, and the automated suite already asserts both render correctly for a
  session holding these exact permissions.
- **No frontend defect found.** Most likely explanation: a stale cached
  session in the browser's `localStorage`, established before `block-agent`
  was seeded (backend commit `71069d2`). **Per ADR-0003 ("lazy session
  restoration... do NOT add a boot-time `/me` gate"), the app never refreshes
  permissions after login** — only a fresh login re-fetches them. This is a
  deliberate, already-approved tradeoff, not touched here.
- **Operational consequence, worth knowing whenever a permission is
  newly seeded or corrected on the backend: existing logged-in sessions in a
  browser will not see it until that operator logs out and back in.** This is
  not specific to `block-agent` — it applies to any permission change made
  while operators have an open session.

## Overall progress

| Milestone | Status |
| --- | --- |
| M0 — Bootstrap | ✅ complete |
| M1-A — Infrastructure foundation | ✅ complete |
| M1-B — Application shell | ✅ complete |
| M1-C — Authentication | ✅ complete |
| **Gate G1** | ✅ **passed with reconciliation** |
| M2a — Secteurs | ✅ complete |
| M2b — Products | ✅ complete |
| M2c — Pattern extraction (reduced scope, Plan B) | ✅ complete |
| **Gate G2** | ⚠️ **conditional pass** — see blockers |
| M3.1 — Admins (incl. permission selector) | ✅ complete |
| M3.2 — Managers | ✅ **complete** |
| **M3.3 — Commercials, plus city-select and multi-select follow-ups** | ✅ **complete** |
| M3.4 — Clients | ⬜ next |
| M3.5 — Client bulk-assign | ⬜ pending |
| M3.6 — Agent onboarding wizard | ⬜ pending |
| M3.x — Admin + Manager + Commercial detail pages (ADR-0014) | ⬜ pending — **blocked by FE-2** |
| M4+ — Money, Stock, Grattage, Overview | ⬜ not started |

**Tests: 343/343 across 22 files** (was 279/21 before M3.3 — Commercials added 45
domain tests and 1 route-authorization case; the two follow-ups added 17 more to
Managers' suite: city-select coverage and the multi-city selector's 8 dedicated
tests). Lint · typecheck · format · build all clean; the full suite was run
standalone multiple times across all three sessions to confirm no flake — the
one contention-triggered failure seen (immediately after a `pnpm build`, before
`pnpm test:ci`) reproduces the already-documented FE-1 pattern, not a
regression from this work.

## Shared pattern layer

Six components, **unmodified since extraction** — have now absorbed a **sixth**
resource (Commercials) with zero changes:

- `ConfirmActionDialog` · `ListPage` · `FormDrawer`
- `ListLoadingState` · `ListErrorState` · `ListEmptyState`

**Deliberately not extracted this session** (per explicit decision — see below):
`DataTable` · `FilterBar` · `StatusBadge` · `MoneyAmount` · `EntityChip` ·
Resource-definition module · URL-filter hook

**Rule-of-Three evidence tally after M3.3, recorded factually, not acted on:**

| Component | Evidence after M3.3 | At ADR-0006's stated threshold? |
| --- | --- | --- |
| `DataTable` | 3 paginated resources (Villes, Managers, Commercials) | Reaches "3" |
| `FilterBar` | 3 resources with server-supported search/multi-filter | Reaches "3" |
| `StatusBadge` | 2 real three-value enums (Managers, Commercials) | Not yet — needs Clients |
| `MoneyAmount` | Still 2 of one shape (Managers, Commercials: raw `bcadd` passthrough) vs. 1 of a different shape (Products: `formatMoney`) — arguably anti-evidence for one shared component, not accumulating evidence for it | Unclear even at "3" |
| `EntityChip` | 0 — filter `<select>`s are not the roadmap's sanctioned infinite-query autocomplete | Not reached |
| Resource-definition module | 0 — Network is not reference-shaped | Not reached |
| URL-filter hook | ADR-0006's own wording ("a resource with 3+ filters") reads as a **per-resource**, not cross-resource, threshold — unlike its five siblings. Managers already had 5 filters at M3.2. Flagged during M3.3 planning, **not resolved** | Ambiguous, unresolved |

**Explicit decision this session: do not extract anything yet.** The URL-filter
hook and every other shared extraction stay deferred, matching M3.2's approach,
until Managers, Commercials and Clients are all built and can be revisited
together as one decision. This is a scope decision already given, not a new
architectural determination — no ADR was written for it.

## Current blockers

| ID | Blocker | Blocks |
| --- | --- | --- |
| **FE-1** | Test-suite flake, raised at M3.2, **not touched this session** | Recommended before the suite grows further |
| **FE-2** | `withPermissionGuards` is shallow — a nested route's own `handle.permission` is silently ignored | The **deferred detail-page milestone** (ADR-0014). Still non-blocking — M3.3 ships no nested route either |
| **BC-G** | Secteurs/Products/Admins index endpoints unpaginated | `DataTable`/`FilterBar` extraction |
| **BC-U** | 🟡 The agent **update** endpoint cannot clear or accept null for `num_d_abonnement` or `ville`, though both columns allow null | Nobody can un-set either field via the UI, ever, until the backend validator changes. Unaffected by M3.3: Commercials' update payload never sends `ville` (that field belongs to Managers only), and `manager_id`/`ville_actuelle`/`secteur` are all correctly `nullable` in the validator |
| **Operational** | Session permissions are cached at login (ADR-0003) and never refreshed. **Whenever a permission is newly seeded or corrected on the backend, an operator already logged in will not see the effect until they log out and back in** — this is how Block/Activate visibility was investigated and cleared this session (see below); not a code defect | Any future backend permission change while operators hold open sessions |

### BC-T — resolved (M3.2, unchanged this session)

`block-agent` is now seeded; block and activate work end to end for both
Managers and Commercials (same permission, same endpoints).

### FE-1 — unchanged this session

Five older test files' `findByRole("alert")` calls still run against the 1000 ms
default timeout while taking 951–1240 ms. Not touched in this session — no new
evidence gathered, no fix applied. Still recommended before the suite grows
further; M3.3 adds 45 more tests to the pile the flake can surface in.

**Governance follow-ups — not blockers** (unchanged):

| ID | Item | Gates |
| --- | --- | --- |
| G2-A/E/F | Gate G2 wording amendments not yet adopted | Formal G2 closure |
| G2-R7 | Fourth-resource estimate needs team agreement | Formal G2 closure |

## M3 detail pages — deferred by ADR-0014

Unchanged. M3.3 ships list-only, contributes no nested route, so FE-2 remains
non-blocking for it exactly as it did for M3.1 and M3.2.

## Backend dependencies

Each row is classified: **defect** (backend behaves wrongly) · **limitation**
(backend cannot express something) · **cleanup** (works, but wasteful) ·
**verified** (correct, merely surprising).

**From the M3.3 contract verification, against `AgentController::indexCommercials`,
independently re-confirmed rather than assumed from Managers:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-N | **defect** | Same swallowed-`ValidationException` pattern as `indexManagers` — invalid filters return 500, not 422 | 🔴 open — unreachable through the UI, same client-side re-validation as Managers |
| BC-O | **defect** | Same case-sensitive `LIKE` search over `nom`/`prenom`/`num_compte`/`num_abonnement` | 🟡 open — surfaced in copy |
| BC-P | **defect** | Same uncast `date_ajout <=` comparison — `date_to` excludes its own day | 🟡 open — field labelled "Joined before" |
| BC-L | **limitation** | Same absence of any sort parameter | 🟡 open — no sortable headers, same as Managers |

**New, registered by M3.3 implementation:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-V | **limitation** | `agents.secteur` has no foreign key to `secteurs` (confirmed: `Secteur` model has no relation back to `Agent`), is filtered by exact match, and the dev database has **zero** seeded secteurs. No options source exists to build a select from | 🟡 open — **no secteur filter or column was built** (ADR-0009: a control with nothing to select would misrepresent the system). Do not invent a distinct-values endpoint |

Carried, unchanged from M3.2:

| ID | Item | Status |
| --- | --- | --- |
| BC-M | Permission catalogue endpoint | ✅ resolved by B-6 |
| BC-A | No seeded account lacking `access-dashboard` | 🔴 open — blocks 403-path QA |
| BC-D | Blank permission row still created by `AdminUserSeeder:37` | 🟡 open |
| BC-G | Secteurs/Products/Admins unpaginated | 🔴 open |
| BC-H | No bounded endpoint for relation pickers (`per_page` max 100) | 🟡 open — **now exercised twice**: Managers' city filter (villes) and Commercials' manager filter (managers) are both bounded at 100. Only 1 manager and 1 commercial exist in the dev database, so this remains invisible until scale |
| BC-B / BC-I | Deletes have no in-use guard → 500 instead of domain 409 | 🟡 open |
| BC-C | No granular reference-data permissions | 🟢 non-blocking |
| BC-E | `exposed_headers` must include `X-Request-Id` when B-4 lands | 🟢 non-blocking |
| BC-F | Contradictory docs on villes 403 envelope | 🟢 docs only |
| BC-J / BC-K | `Product.value` semantics; missing composite unique index | 🟢 non-blocking |
| BC-S | `agents.ville` (Managers) is free-text, no FK to `villes` | 🟡 open — **now a two-instance class** alongside `ville_actuelle` (Commercials) |
| BC-U | Update endpoint cannot null `num_d_abonnement`/`ville` | 🟡 open |
| — | `view-permissions` permission (B-6 deferred the OR-gate cleanup) | 🟢 non-blocking |

## Domain inventory

```
src/domains/
├── auth/                  M1-C
├── reference/
│   ├── villes/            M1   (paginated · search · sort · exports a picker)
│   ├── secteurs/          M2a  (unpaginated · 1 relation filter)
│   └── products/          M2b  (unpaginated · 1 enum filter · money)
└── network/
    ├── admins/            M3.1 (unpaginated · granular permissions · picker)
    ├── managers/          M3.2 (paginated · search · 5 filters · status enum ·
    │                            backend-formatted money · NO sort, NO create,
    │                            NO detail page · exports a picker, added M3.3;
    │                            city field is a Villes-backed select; area of
    │                            responsibility is a Villes-backed multi-city
    │                            checkbox selector, ", "-joined into the same
    │                            single backend string, ADR-0015)
    └── commercials/        M3.3 (paginated · search · 4 filters · status enum ·
                                  backend-formatted money · NO sort, NO create,
                                  NO detail page, NO secteur filter, NO manager
                                  reassignment; city field is a Villes-backed
                                  select, same as Managers')
```
