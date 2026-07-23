# Project Status

**The current state of the project.** Overwrite this file after every completed
milestone — it describes *now*, not history. History lives in `decisions.md` and git.

_Last updated: 2026-07-23_

---

## Current milestone

**M3 — Network / identity graph.** M3.1 (Admins), M3.2 (Managers), M3.3
(Commercials), M3.4 (Clients) and **M3.5 (Client bulk-assign) are all
complete.** **M3.6 (Agent onboarding wizard) is next — not started.** M3.x
(Admin/Manager/Commercial detail pages, ADR-0014) remains pending, blocked by
FE-2.

## Current branch

`main`, level with `origin/main` before this session's commit. `eaaa78b` (M3.4
Clients) is HEAD at the start of this session. **M3.5 (Client bulk-assign) —
current-page row selection, current-page select-all, a bulk action bar, a
dedicated bulk-assign sheet, an active-only Commercials picker, `assign-client`
permission gating, the bulk-assign mutation, selection-reset rules, success
invalidation, and field/generic error handling — has passed manual UI
validation and is approved, committed and pushed this session.** No backend
changes were required or made — M3.5 builds entirely against the existing
`ClientController::assignBulk` contract verified during its own discovery pass.

## Last completed implementation

**M3.5 — Client bulk-assign.** See its own section below for the full
write-up. The previous entry, kept for continuity:

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

## M3.4 — Clients (complete)

The fourth Network domain, and the last of M3's agent/identity list screens
before M3.5's bulk-assign work. Scope was given explicitly, not derived:
list, server pagination, search, three filters (`status`, `assigned`,
`ville_comercial`), edit (`phone` and `ville` only), a single status toggle,
permission gating, and loading/empty/error states. **Explicitly deferred by
decision, not by contract necessity**: Create Client, Delete Client,
Assign/Reassign/Unassign, Bulk Assign (named as its own M3.5 deliverable),
Reset Password, Statistics, a detail page (ADR-0014), and map/location
editing.

**Contract-verified independently from `ClientController`, not inherited
from the Agent domains by resemblance** — the planning pass found `index()`
performs **no `transform()`** (unlike every Agent domain), so the row is the
raw Eloquent serialization riding with many more fields than the screen
consumes (`agent_id`, `secteur_comercial`, `dept_to_commercial`, lat/long,
`otp_*`, `last_login_at`, `updated_at` — all confirmed present on the wire,
deliberately left unmapped per ADR-0008).

**Clients' status model is a different shape than Managers'/Commercials',
and the UI was built to match it, not to reuse their pattern by default**: a
single `PATCH /{id}/status` **toggle** endpoint, not a block/activate pair,
and a **third real status value** (`pending`, not `inactive`) that only ever
originates from the public OTP signup flow — never created by this
milestone. `ClientStatusDialog` computes its single available action's
label and copy from `client.status !== "active"` rather than force-fitting
the two-dialog Agent pattern; a `pending` client's only transition is
"Activate", exercised by its own dedicated test.

**The nested `agent` relation (present because of `index()`'s
`with(['agent:id,nom,prenom,num_compte'])` eager load) is reduced to a
single `agentName: string | null` display string at the mapper boundary** —
consistent with how Commercials already reduces its `manager` relation, and
with ADR-0012 (no shared/merged mapper across domains).

**No new shared abstraction was introduced.** The city filter, the
Villes-backed edit-select with legacy-value fallback, and the single-dialog
confirm pattern are each a resource-specific copy, matching Managers'/
Commercials' precedent — Rule-of-Three reads closer for several shared
components now (see the updated tally below), but nothing was extracted
this session, by the same explicit decision M3.3 recorded.

**Manual UI validation passed.** Before it could run, the dev database held
**zero clients** — Create Client is out of scope, so there was no in-product
way to populate one. A dev-only, idempotent fixture seeder,
`DevClientSeeder` (backend, `database/seeders/DevClientSeeder.php`), was
added to unblock this — modelled directly on the existing `DevAgentSeeder`
precedent: environment-guarded to local/development/testing, not registered
in `DatabaseSeeder`, run explicitly (`php artisan db:seed
--class=DevClientSeeder`). It resolves its commercial **dynamically**
(`Agent::isCommercials()->active()->first()`), never assumes `agent_id = 2`
— confirmed wrong in this environment, where the only commercial is id
`636` (`DEV-CPT-COMMERCIAL-001`) — and seeds 4 clients spanning all three
statuses and both assignment states, keyed idempotently on a dedicated
`phone` block (`0600100001`–`0600100004`) via `firstOrCreate`, so reseeding
never duplicates and never stomps a tester's in-progress state (e.g. a
manually toggled status). Verified end-to-end against the real running
backend: `GET /admin/clients` and its `status`/`assigned` filters all
return the expected rows. The existing general-purpose `ClientSeeder` was
deliberately left untouched — it hardcodes `agent_id = 2` and is not
idempotent against clients' unique `phone` column; fixing a seeder of
unclear ownership was out of scope for a fixture-only task.

**New backend finding, registered this milestone:**

- **BC-W** — `ClientController`'s single-record methods use `findOrFail`,
  which is not caught specifically, so a nonexistent client id 500s rather
  than 404s. Live-confirmed. Not reachable through this UI (no detail page,
  no direct id navigation), so non-blocking for M3.4, but worth backend
  attention.

**Two known limitation classes gained a third instance, not a new one:**

- **BC-N** (validation exceptions swallowed by a bare `catch`, returning 500
  instead of 422) — confirmed for `ClientController::update()` too. A
  duplicate-phone update shows a generic error banner, not a field message.
- **BC-U** (update validators missing `nullable`, so a nullable column can
  never be cleared back to null through the UI) — confirmed for
  `ville_comercial` too.

**Tests:** 43 new tests in `clients-list-page.test.tsx`, covering the
envelope contract, row mapping (including all-three-null fields), the
three-value status enum, search, all three real filters, pagination,
error/retry, permission gating (incl. fail-closed and explicit
never-offers-create/delete/assign assertions), edit-form validation and
payload shape, legacy-ville preservation, 422 field mapping, and the status
action across all three status values. `route-authorization.test.tsx`
gained 2 more parameterized cases (`CLIENTS_PATH`, refuse + redirect).
**388/388 across 23 files**, run twice standalone to rule out FE-1's known
flake — stable both times.

## M3.5 — Client bulk-assign (complete)

The fifth and final Network deliverable named by the roadmap's M3 milestone.
A fresh discovery pass was run before any implementation — assuming nothing
about the bulk-assign endpoint's shape, permission or constraints from having
just built Clients' list screen (the same discipline M3.2/M3.3/M3.4 each
required). Its own discovery report is the source for everything below;
implementation followed explicit scope, model and error-handling decisions
given afterward, not derived mid-implementation.

**Scope, explicitly bulk-only:**

- Row checkboxes and a header select-all, **current-page only** — never a
  wider "select all matching this filter", which the backend cannot express
  (`PATCH /admin/clients/assign-bulk` accepts only explicit `client_ids`, no
  filter object).
- A bulk action bar (selected count, "Clear selection", "Assign to
  commercial"), rendered only when the selection is non-empty.
- A dedicated `ClientBulkAssignSheet`, built on the existing `FormDrawer`
  shell — **not** a repurposed `ConfirmActionDialog`, which is
  destructive-action-shaped (hardcoded `variant="destructive"`, no input
  slot) and does not fit a form that needs to collect a target commercial.
- A new Commercials picker (`useCommercialOptionsQuery`/`CommercialOption`,
  exported from `commercials/index.ts`), filtered **`status=active` only** —
  unlike Managers' own picker, which fetches every manager regardless of
  status. Filtering server-side means the picker can never offer a
  selection `assignBulk` would reject.
- `ASSIGN_CLIENT` (`assign-client`) registered in the permission registry and
  used to gate checkboxes, select-all and the action bar — fail-closed,
  verified by test. The commercial picker inside the sheet is gated
  **separately** on `view-agents` (a different permission), mirroring
  `useVilleOptionsQuery`'s `enabled` pattern.
- `assignClientsBulk`/`useAssignClientsBulkMutation`: `PATCH
  /admin/clients/assign-bulk` with `{agent_id, client_ids}` only. Success
  invalidates Clients' list space and clears the selection (the caller's
  responsibility, not the mutation's).
- Selection-reset rules: cleared whenever page, page size, search, status,
  assigned or city changes — implemented as a render-time state adjustment
  (`if (selectionKey !== lastSelectionKey) { … }`), not a `useEffect`, to
  avoid the cascading-render lint rule (`react-hooks/set-state-in-effect`).
  Never persisted across page navigation, never fetches other pages.
  Because `per_page` is already clamped to `MAX_PER_PAGE` (100) before any
  row renders, a full-page select-all can never produce more than 100 ids —
  the same cap the backend's own validator enforces — pinned by a dedicated
  100-row test.
- Error handling: `assignBulk` is the **first** Clients endpoint that
  correctly catches `ValidationException` before its generic handler (BC-N
  does **not** apply here) — a malformed `agent_id`/`client_ids` shape 422s
  with a real `errors` object, mapped onto the commercial field. The
  business-rule rejection ("agent_id must reference an active commercial",
  "some clients do not exist") is a **separate**, hand-rolled
  `{success:false, message}` 422 with no `errors` key and no `code` — it
  normalizes to `kind: "unknown"`, not `"validation"` or `"domain"`, and is
  deliberately folded into the same generic-failure branch every other
  domain form already uses for non-validation errors. **Not matched by
  message string, and not worked around** — the missing `code` is recorded
  as a backend follow-up, not fixed client-side.
- Copy states plainly, in the sheet: only the assigned commercial changes —
  each client's city and sector are left exactly as they are. Confirmed from
  source: `ClientController::assignBulk` updates `agent_id` only (unlike the
  legacy single-client `POST /{id}/assign`, which also rewrites `ville`/
  `secteur` to match the new agent) — the backend's own route comment says
  so explicitly ("Admin-only bulk reassignment (PATCH; updates agent_id
  only)").

**Explicitly deferred, by decision, not by contract necessity** — `assign-client`
also gates all three of these server-side (`routes/api.php:319-332` shares
the identical middleware across `assignToAgent`/`reassign`/
`unassignFromAgent`), so holding the permission is not evidence they are in
scope:

- Single-client Assign, Reassign, Unassign
- Create Client, Delete Client
- Reset Password, Statistics
- A detail page (ADR-0014, unchanged)

**A real deviation from two frozen documents, found during this session's own
doc-closure review and recorded — not silently dropped — as ADR-0016:** the
roadmap's M3 deliverables and Design System §14 both name an "all-pages
selection, deliberate second step" and a "100 max" count surfaced in the bulk
action bar as part of Client bulk-assign. M3.5 ships **current-page-only**
selection, given as an explicit scope instruction, with neither of those. See
ADR-0016 for the full reasoning, why it is not the same gap as "select all
matching filters" (correctly ruled out below as unbuildable against today's
contract), and the owed work for a later session.

**No new shared abstraction was introduced.** Row selection and the bulk
action bar are the **first** instance of this pattern in the product — zero
prior evidence, nowhere near a Rule-of-Three question. The Commercials picker
export is the **second** instance of the cross-domain picker-export pattern
(Managers → Commercials was the first) — two, not three, still short of a
generalization decision. See the updated tally below.

**No backend changes were needed.** M3.5 builds entirely against
`ClientController::assignBulk`, already live and already correctly
implemented for the validation-envelope half of its error contract — the
first Clients endpoint found in this state. The missing `code` on the
business-rule rejection is a backend follow-up, not a defect blocking this
milestone.

**New backend finding, registered this milestone:**

- **BC-X** — `ClientController::assignBulk`'s (and `reassign`'s)
  business-rule rejection ("agent_id must reference an active commercial",
  "some clients do not exist") is a hand-rolled `{success:false, message}`
  422 with no `errors` key and no `code` — unlike every coded domain error
  elsewhere in the product (e.g. `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`).
  `normalizeError()` classifies it as `kind: "unknown"`, so the frontend has
  no principled way to distinguish it from any other unclassified failure
  beyond a generic message. Non-blocking (a working generic error state
  covers it), but worth a backend consultation item: give this rejection a
  `code`, matching the product's own convention.

**Manual UI validation passed**, against the real backend: selection,
select-all, the action bar, the sheet's active-only commercial picker
(bounded at the seeded environment's one active commercial, id `636`),
successful assignment with `ville`/`secteur` visibly unchanged, and the
generic error path for an invalid target agent were all exercised live.

**Tests:** 44 new tests in `clients-list-page.test.tsx` (43 → 62 in that
file), covering: `assign-client` permission gating and fail-closed behavior,
individual row selection, current-page select-all, selection clearing on
every one of the six tracked param changes, non-persistence across page
navigation, the 100-id cap on a full 100-row page, payload shape, success
invalidation and selection clearing, the validation-envelope 422 mapped onto
the commercial field, the generic-copy path for the code-less business-rule
422 (asserted to NOT contain the backend's own message text), the
active-only/bounded commercial picker request, and that no single-client
assign/reassign/unassign or other out-of-scope control was added. One
pre-existing test ("never offers create, delete, assign or bulk-assign") was
narrowed to "never offers create, delete, or single-client assign/reassign/
unassign, bulk-assign is the only assignment action" — a deliberate,
approved test update reflecting the scope decision itself, not a workaround.
**407/407 across 23 files**, run standalone twice to rule out FE-1's known
flake — stable both times; one interleaved run hit FE-1 on five unrelated,
untouched files under heavier machine load, confirming the flake rather than
a regression.

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
| M3.3 — Commercials, plus city-select and multi-select follow-ups | ✅ complete |
| M3.4 — Clients | ✅ complete |
| **M3.5 — Client bulk-assign** | ✅ **complete** |
| M3.6 — Agent onboarding wizard | ⬜ next — not started |
| M3.x — Admin + Manager + Commercial detail pages (ADR-0014) | ⬜ pending — **blocked by FE-2** |
| M4+ — Money, Stock, Grattage, Overview | ⬜ not started |

**Tests: 407/407 across 23 files** (was 388/23 before M3.5 — Clients' own
spec file grew from 43 to 62 tests; no new test file was needed since M3.5
extends the existing Clients list screen rather than adding a route). Lint ·
typecheck · format · build all clean; the full suite was run standalone
twice this session to confirm no flake — stable both times.

## Shared pattern layer

Six components, **unmodified since extraction** — have now absorbed M3.5's
bulk-assign work with zero changes (the new checkbox column, select-all and
action bar were all built inline in `ClientsListPage`; the new sheet is built
on the unmodified `FormDrawer`):

- `ConfirmActionDialog` · `ListPage` · `FormDrawer`
- `ListLoadingState` · `ListErrorState` · `ListEmptyState`

**Deliberately not extracted this session** (per explicit decision — see below):
`DataTable` · `FilterBar` · `StatusBadge` · `MoneyAmount` · `EntityChip` ·
Resource-definition module · URL-filter hook

**Rule-of-Three evidence tally after M3.5, recorded factually, not acted on**
(unchanged from M3.4 except the two new rows — M3.5 added no new list
resource, so `DataTable`/`FilterBar`/`StatusBadge`/`MoneyAmount`/`EntityChip`/
resource-definition module/URL-filter hook evidence is exactly as it was):

| Component | Evidence | At ADR-0006's stated threshold? |
| --- | --- | --- |
| `DataTable` | 4 paginated resources (Villes, Managers, Commercials, Clients) | Reaches "3" |
| `FilterBar` | 4 resources with server-supported search/multi-filter | Reaches "3" |
| `StatusBadge` | 3 resources with a real status enum, but only **2 distinct vocabularies**: Managers and Commercials share one (`active`/`blocked`/`inactive`); Clients introduces a second (`active`/`blocked`/`pending`) | Reaches the stated count of "3", though the vocabularies aren't uniform |
| `MoneyAmount` | 3 distinct serialization shapes, not 3 callers of *one* shape: Managers/Commercials (`avanceTotal`, a `bcadd`-computed accessor), Clients (`solde`, a plain `decimal:2`-cast column, no computation), Products (`formatMoney`-formatted) — arguably strengthens the case *against* one shared component, since none of the three match | Still unclear even at "3" |
| `EntityChip` | 0 — filter `<select>`s are not the roadmap's sanctioned infinite-query autocomplete | Not reached |
| Resource-definition module | 0 — Network is not reference-shaped | Not reached |
| URL-filter hook | ADR-0006's own wording ("a resource with 3+ filters") reads as a **per-resource**, not cross-resource, threshold — unlike its five siblings. Managers already had 5 filters at M3.2; Clients has 4 (`search`, `status`, `assigned`, `ville`). Flagged during M3.3 planning, **still not resolved** | Ambiguous, unresolved |
| **Cross-domain picker export** (`useVilleOptionsQuery` → `useManagerOptionsQuery` → **`useCommercialOptionsQuery`**, new this session) | **2** instances of the pattern itself (Managers exporting to Commercials, now Commercials exporting to Clients) — 3 individual picker exports exist, but the *pattern being evaluated* (one domain exporting an options query for a sibling's picker) has occurred twice | Not yet at "3" — the next domain that needs a sibling picker is the actual test case |
| **Row selection / bulk action bar** (new this session) | **1** — M3.5 is the first and only bulk-selection UI in the product | Not reached, not close |

**Explicit decision this session: still do not extract anything**, for the
same reasons recorded at M3.4 — the tally above is unchanged from M3.4 on
every row that predates M3.5, and M3.5's own two new rows are each far below
threshold. No extraction happened, no ADR was written, and the M3.4-era
Rule-of-Three decision point ("due, not deferred") remains open — it was not
resolved by M3.5, which touched no shared component either way.

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
further; the suite is now at 388 tests, 43 more than when this was last raised.

**Governance follow-ups — not blockers** (unchanged):

| ID | Item | Gates |
| --- | --- | --- |
| G2-A/E/F | Gate G2 wording amendments not yet adopted | Formal G2 closure |
| G2-R7 | Fourth-resource estimate needs team agreement | Formal G2 closure |

## M3 detail pages — deferred by ADR-0014

Unchanged. M3.4 and M3.5 both ship with no nested route (M3.5 extends the
existing Clients list route in place, rather than adding one), so FE-2
remains non-blocking exactly as it did for M3.1–M3.4. All four list-management
resources are now built with no detail page among them.

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

**From the M3.4 contract verification, against `ClientController`, independently
re-confirmed rather than assumed from the Agent domains:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-N | **defect** | Third confirmed instance — `ClientController::update()` validates inside a bare `catch (\Exception)`, so e.g. a duplicate-phone update returns 500, not 422 | 🔴 open — the form shows a generic error banner, not a field message |
| BC-U | **limitation** | Third confirmed instance — the `update()` validator has no `nullable` for `ville_comercial`, though the column allows null | 🟡 open — a client's city can never be explicitly cleared through the UI |
| BC-W | **defect, new** | `ClientController`'s single-record methods use `findOrFail`, not caught specifically, so a nonexistent client id 500s instead of 404ing | 🟡 open — live-confirmed, unreachable through this UI (no detail page, no direct id navigation) |

**From the M3.5 contract verification, against `ClientController::assignBulk`,
independently re-confirmed rather than assumed from `update`/`index`:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive** | `assignBulk`/`reassign` correctly catch `ValidationException` before their generic handler — BC-N does **not** extend to these two endpoints, the first Clients actions found in this state | ✅ no action needed, recorded so a future session does not assume BC-N universally |
| BC-X | **limitation, new** | `assignBulk`'s (and `reassign`'s) business-rule rejection ("agent_id must reference an active commercial", "some clients do not exist") is a hand-rolled `{success:false, message}` 422 with no `errors` key and no `code`, unlike the product's own coded-domain-error convention (e.g. `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`) | 🟡 open — normalizes to `kind:"unknown"`; the frontend shows a generic error, which is honest but not specific. Non-blocking |

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
    ├── commercials/        M3.3 (paginated · search · 4 filters · status enum ·
    │                             backend-formatted money · NO sort, NO create,
    │                             NO detail page, NO secteur filter, NO manager
    │                             reassignment; city field is a Villes-backed
    │                             select, same as Managers'; exports an
    │                             active-only CommercialOption picker, added
    │                             M3.5, for Clients' bulk-assign sheet)
    └── clients/            M3.4 (paginated · search · 3 filters (status,
                                   assigned, ville) · a THIRD status enum
                                   (active/blocked/pending — distinct from
                                   Managers'/Commercials' active/blocked/inactive)
                                   · a single status TOGGLE, not block/activate ·
                                   raw decimal-cast money (solde), a distinct
                                   shape from Managers'/Commercials' bcadd
                                   accessor · NO sort, NO create, NO delete, NO
                                   detail page; city field is a Villes-backed
                                   select, same pattern as Managers'/
                                   Commercials') + M3.5 (current-page row
                                   selection, current-page select-all, a bulk
                                   action bar, and a bulk-assign sheet against
                                   `PATCH .../assign-bulk`; NO single-client
                                   assign/reassign/unassign — still deferred)
```
