# Project Status

**The current state of the project.** Overwrite this file after every completed
milestone — it describes *now*, not history. History lives in `decisions.md` and git.

_Last updated: 2026-08-15_

---

## Current milestone

**M3 — Network / identity graph — COMPLETE** (all six sub-milestones).
**M4 — Money — COMPLETE.** All three Money resources now exist end to end:
Cheques (M4.2, submit/list/pending queue/detail/approve/reject/annuler),
Deposits (M4.3, submit/list/detail/validate/reject), and Debt Payments
(M4.4, submit/list — the simplest of the three, `list + submit` only, no
detail page and no lifecycle: the backend has no `status`/`type` column
and `show()`/`destroy()` are both dead routes). The FTA §8 freshness rule
was also retrofitted onto every irreversible Money confirmation this phase
(`useFreshConfirm`, see below) — this is the M4 "Gate G4" closure referred
to throughout this file and `decisions.md`.

**M5 — Stock is COMPLETE at the implementation level, all five phases.** A
full M5 discovery pass ran across all four Stock movement types (Bons,
Allocations, Agent Transfers, Agent Stock Returns) before any
implementation, producing an approved 5-phase order: Agent Stock Returns →
Agent Transfers → shared-component extraction → Allocations → Bons. Every
phase — Agent Stock Returns, Agent Transfers, Allocations, and now Bons —
ships the full draft → add-lines → validate lifecycle (Bons alone also
ships cancel — BC-AB, the only Stock resource with one). Return/Transfer
each have their own Manager→Commercial cascading picker (deliberately
domain-local, ADR-0021); Allocations and Bons have no cascade at all —
their binding pairs needed two NEW minimal backend reference endpoints
instead (Companies, then Suppliers — both read-only, ADR-0023). All four
resources register their own error codes explicitly, never derived
mechanically from another (13 for Returns, 15 for Transfers, 10 for
Allocations, 9 for Bons — ADR-0022), and all four reuse the shared
`LineItemsEditor` (ADR-0019) extracted at Phase 1's own first caller.

**Two backend contract updates landed after Bons shipped, and the frontend
was updated to match (re-verified from source, not assumed, ADR-0022):**
`allocation_number`/`transfer_number` are now backend-generated
(`DocumentNumberService`) — both create forms' own number input was
removed entirely, not hidden (ADR-0024). And two new per-owner stock
endpoints (`GET /admin/companies/{company}/stock`,
`GET /admin/managers/{manager}/stock`, both pre-filtered to
`available_quantity > 0`) are now the source of truth for Allocations' and
Agent Transfers' own "add line" product pickers, replacing the generic,
unfiltered product catalogue those two pickers used before (ADR-0025) —
Return's and Bons' own pickers are unchanged, out of that update's scope.

**Manual validation status, unchanged from before Bons shipped and still
owed:** Agent Stock Returns is manually validated; Agent Transfers,
Allocations and Bons are not — all three passed implementation-level
verification only (automated suites, quality gates, backend contract
verification). Bons' own shipping resolves Allocations' prior external
blocker (no stock source existed before Bons could materialize real
company stock) — Allocations can now, in principle, be validated manually
against real data; that manual pass, and Transfers'/Bons' own, are still
owed as a follow-up, not attempted in this documentation-only session.

**M6 — Grattage (the seam) — COMPLETE, manual QA passed.** Four phases,
each its own discovery → approval → implementation → commit cycle
(ADR-0022 discipline throughout): Grattage Invoices (list/detail/cancel),
the Grattage Outstanding restock-gate domain (a private full read plus one
narrow public hook), Stock → Grattage restock-gate integration (Agent
Transfer's hard block; Allocation's own proactive gate was added then
removed — see below), and Deposit ↔ Grattage Invoice linking. See "M6 —
Grattage (the seam)" below for the full write-up, and ADR-0026 through
ADR-0032 for the permanent decisions this milestone produced.

**A backend contract change landed mid-milestone and the frontend was
corrected to match, re-verified from source rather than assumed
(ADR-0022):** backend commit `9af5d00` replaced Allocation's team-wide hard
block (`ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION`, exception class
deleted outright) with a numeric, settlement-aware deposit-capacity formula
that a commercial's validated grattage settlement now feeds into — an
undischarged obligation restores zero capacity but is never, by itself, a
refusal. The proactive restock-gate integration that had briefly shipped on
`AllocationDetailPage` (reading `useGrattageRestockGateQuery`) was removed
in a targeted, approved correction (`59888a5`); Allocation's sole remaining
gate is the reactive `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` 409, and the
frontend does not (and must not) re-derive that capacity client-side.
Agent Transfer's own hard gate
(`TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`) is unaffected — its
backend contract did not change, and it remains the only live caller of
`useGrattageRestockGateQuery` (the one sanctioned Stock←Grattage
domain-to-domain import).

**Explicitly NOT delivered by M6, carried into M7 by decision:** a
per-agent Outstanding-obligation UI view. The data layer exists
(`useGrattageOutstandingQuery`, kept domain-private) but has no page,
route, or navigation entry — that UI is an M7 Agent 360 deliverable, not an
M6 one (see `next-session.md`).

**M7 — Overview & workspaces, Agent 360, Client 360 — is the current
milestone. Agent 360 and Client 360, the first two of its three composed
surfaces, are both now COMPLETE, manual QA passed.** Agent 360: five
phases plus a manual-QA finalization pass — workspace foundation, full
role-aware Agent Edit, Money/Stock panels, Grattage Outstanding, and the
zero-stock Manager reassignment guard, closing the milestone's one genuine
gap against the frozen architecture rather than deferring it again. See
"M7 — Agent 360" below for the full write-up. Client 360: three
implementation phases (foundation `9cc464a`; Commercial
relationship/reassignment/assignment history `506e992`; Grattage purchase
history `22f2ba9`) plus two manual-QA fixes found during the real-browser
pass (same-Commercial reassignment left Reassign enabled with no request
skipped for it, `55cc33d`; Agent 360's own Available Grattage capacity
gave no indication it could be blocked, `47ab778`) — fully complete
against the frozen requirement (`phase8-architecture.html` §6: "profile/
assignment history (Network) with purchase history via grattage invoices
(Grattage)"), manual QA passed against the real running backend. See "M7
— Client 360" below for the full write-up. **The Overview widget grid,
the third and final M7 surface, is not yet started** — discovery is the
next task, see `next-session.md`.

M3.x (Admin/Manager/Commercial detail pages, ADR-0014) remains the only
open M3 item, blocked by FE-2 — unaffected by M4, M5 or M6.

## Current branch

`main`, level with `origin/main` at `47ab778` (pushed this session). Since
M6 shipped: Agent 360 workspace foundation (`c392a7e`), full Agent Edit
(`21c6e05`), Money/Stock workspace panels (`2ff0d5a`), Grattage Outstanding
panel (`69f50aa`), the zero-stock Manager reassignment guard (`1aa1d66`),
the manual-QA finalization pass (`bc54e55`), Client 360 foundation
(`9cc464a`), Commercial relationship/assignment history (`506e992`),
Grattage purchase history (`22f2ba9`), the same-Commercial reassignment
disable fix (`55cc33d`), and the Agent 360 blocked-Grattage-capacity
clarification (`47ab778`). No uncommitted files remain besides this
documentation pass. See `next-session.md` for verification commands.

## Last completed implementation

**M7 — Client 360 — COMPLETE, manual QA passed.** See its own section
below for the full write-up. The previous entries, kept for continuity:

**M7 — Agent 360 — COMPLETE, manual QA passed.** See its own section
below for the full write-up. The previous entries, kept for continuity:

**M6 — Grattage (the seam) — COMPLETE, manual QA passed.** See its own
section below for the full write-up. The previous entries, kept for
continuity:

**Stock-aware product selection + backend-generated document numbers —
COMPLETE.** A post-Bons backend contract update (Companies/Suppliers/
company-stock/manager-stock endpoints; `allocation_number`/
`transfer_number` now backend-generated) integrated into Allocations' and
Agent Transfers' own create forms and detail pages. See "M5 — Stock is
COMPLETE" above and ADR-0023/0024/0025. The previous entries, kept for
continuity:

**M5 Phase 5 — Bons — COMPLETE at the implementation level.** See its own
section below for the full write-up. The previous entries, kept for
continuity:

**M5 Phase 4 — Allocations — COMPLETE at the implementation level; manual
validation BLOCKED on Bons (Phase 5).** See its own section below for the
full write-up. The previous entries, kept for continuity:

**M5 Phase 2 — Agent Transfers — COMPLETE.** See its own section below for
the full write-up. The previous entries, kept for continuity:

**M5 Phase 1 — Agent Stock Returns — COMPLETE.** See its own section below.

**Freshness-rule retrofit (`useFreshConfirm`) — COMPLETE.** See its own
section below.

**M4.4 — Debt Payments — COMPLETE.** See its own section below.

**M4.3 — Deposits (all four phases) — COMPLETE.** See its own section below.

**M4.2 Phase 3B + Phase 3C — Cheques (pending queue, detail page,
approve/reject/annuler) — COMPLETE.** See their own sections below for the
full write-up. The previous entries, kept for continuity:

**M4.2 Phase 3A — Cheques (creation) — COMPLETE.** See its own section
below for the full write-up. The previous entries, kept for continuity:

**M4.2 Phase 1+2 — Cheques (list, read-only) — COMPLETE.** See its own
section below for the full write-up. The previous entries, kept for
continuity:

**M4.1 — Money infrastructure — COMPLETE.** See its own section below for
the full write-up. The previous entries, kept for continuity:

**M3.6 — Agent onboarding wizard — COMPLETE.** Manually validated against
the real backend; every issue that validation found is fixed and recorded in
its own section below, which is the authoritative write-up. The previous
entry, kept for continuity:

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

## M3.6 — Agent onboarding wizard (complete)

**Status: COMPLETE.** Implementation, manual validation against the real
backend, and three follow-up rounds of fixes the validation surfaced are all
done; every automated gate re-passes after each round. This section is now
the closed record — see "Follow-up 3/4/5" below for what manual validation
actually found and how each was fixed.

A fresh discovery pass was run before any implementation, per the same
discipline every prior M3 sub-milestone required, and per the process fix
ADR-0016 itself asked for: the frozen roadmap's M3 section, Design System
§12/§13, and FTA §10/D-9 were read in full before scope was fixed, not
derived from the backend contract alone. Its own discovery report is the
source for the contract facts below.

**A dedicated, new domain** — `domains/network/agent-onboarding/` — not
hosted inside Managers or Commercials. `AgentController::store` creates
*either* role through one controller action, so the wizard belongs to
neither existing domain; forcing it into one would misrepresent ownership
under ADR-0012. This is the first **workflow domain** in the product (every
prior domain maps 1:1 to one backend resource with its own list); see the
Rule-of-Three tally below for why this did not get its own ADR, and
`next-session.md` for why the credential-display decision did.

**Wizard flow, one RHF instance across all five steps**: Identity →
Documents → Financial → Moto → Review → Success. Not five separate forms
and not a state machine (FTA D-9 — the wizard's only real complexity is a
role-conditional branch and a moto-conditional branch, not a non-linear step
graph). Back navigation preserves every entered value and every chosen file
by construction — `stepIndex` only decides which step's JSX renders; the
form instance itself never unmounts, and nothing in the implementation ever
calls `form.reset()` except explicitly, after a *successful* submission's
"Onboard another agent" action. A failed submission leaves the form and
every field exactly as it was — no code path clears it, which is what
satisfies Design System §23's "a lost connection MUST NOT cost a filled
onboarding wizard its data" (about surviving a failed submission, not a
browser reload — no localStorage/autosave draft persistence exists or was
asked for by any frozen document).

**The first multipart/`FormData` request in this product.** File uploads are
mandatory on create, so this is the first non-JSON request body anywhere in
the codebase. `httpClient` needed no changes — axios sets the multipart
boundary itself from a `FormData` instance.

**A local, domain-only `FileUploadField`**, in
`agent-onboarding/components/`, reused ~11 times within this one wizard
(Documents' 7 slots, Moto's 4) — same-screen repetition inside a single
flow, not cross-resource evidence, so it stays domain-local per ADR-0006's
Rule-of-Three discipline rather than moving to `shared/`. A companion local
`TextField` (label+input+error) avoids repeating the same three elements
~20 times across the five steps. Neither is a new architectural pattern;
both are correct applications of an existing one, which is why neither
warranted its own ADR (see `next-session.md`).

**Every file field respects the REAL backend limits, verified from source,
not assumed from the Design System**: every one of the up to 11 possible
uploads is capped at 2MB (`max:2048`) — the Design System's own stated "5MB
proofs" tier does not exist anywhere in the actual validator, and the UI
does not claim one. MIME acceptance is exact, not uniform: `photo`/CIN
front/back accept images only (`mimes:jpeg,png,jpg`); every other document
(habitat certificate, auto-entrepreneur card, both optional fiches, all
four moto documents) accepts PDF or image (`mimes:pdf,jpeg,png,jpg`).

**Role-conditional fields (manager vs commercial), verified NOT to be
validator-required by either role** — `ville_sous_responsabilite` (manager)
and `manager_id`/`ville_actuelle`/`secteur` (commercial) are all `nullable`
server-side; the backend force-nulls the wrong role's fields silently on
create. The distinction is about which fields are shown, not additional
validation. The commercial's manager picker reuses Managers' existing
`useManagerOptionsQuery` — the same bounded `<select>` pattern already used
everywhere else in Network, **not** the product's first async entity-chip
picker, despite Design System §12's unconditional "MUST use an entity chip
for any foreign key in a form." An explicit, approved narrowing, not an
oversight — see `next-session.md` for why this did not get its own ADR
either, and stays a recorded decision instead.

**Moto is entirely conditional on `has_moto`**, mirroring
`required_if:has_moto` exactly: a checkbox, then (only when checked) the
moto type radio, chassis number, and 4 required documents.

**The essence/moto cross-field rule mirrors `AgentController::store`'s own
manual business-rule check exactly**: `montant_essence` must be 0 whenever
the agent has no motorcycle, or the motorcycle is electric — only a
gas-moto agent may have a nonzero fuel amount. **Deliberately validated on
leaving the Moto step, not the Financial step where the field itself
lives** — the rule depends on `hasMoto`/`typeMoto`, which do not exist yet
while the operator is still on Financial (Moto is the next step in the
frozen order), so gating the Financial→Moto transition on it would block a
legitimate "fuel amount now, motorcycle details next" flow before the
information it depends on has been entered. This is a deliberate,
documented design choice (commented in `model/agent-onboarding.ts`), not an
oversight — do not move it back to Financial without re-deriving why it was
placed on Moto.

**Two entry points, one wizard** — "Create Manager" on the Managers list
page and "Create Commercial" on the Commercials list page, both gated on
the new `CREATE_AGENT` permission and navigating to the same route with
`?role=manager`/`?role=commercial`, which the wizard reads to preselect
(but not lock) the role radio. **No new sidebar navigation entry** — by
decision, matching how Villes/Secteurs/Products' own create actions are
list-page buttons, not nav items.

**A dedicated success screen, not a toast.** `store()`'s response carries a
backend-generated account number (`MG#####`/`CM#####`) and an 8-character
random password, both computed server-side — there is no field anywhere in
the form for either. The password is shown exactly once; `Agent::$hidden`
excludes it from every later read, so a toast-and-navigate flow (the
pattern every other create/edit form in this product uses) would lose it
permanently. **See ADR-0017** — this is the one new architectural decision
recorded from M3.6, because it is a genuine, deliberate exception to FTA
§10's own documented submission flow, not a styling preference.

**Explicitly deferred, by decision, not by contract necessity**:

- Edit mode for the wizard — `AgentController::update` accepts nearly the
  same fields, but M3.6 is create-only; editing an existing agent is the
  still-pending, FE-2-blocked detail-page milestone's job.
- An agent detail page (ADR-0014, unchanged).
- A generic wizard framework — FTA D-9 rejects a state-machine library for
  the one wizard in the product; nothing here builds toward a second one.
- A shared/generic upload framework — `FileUploadField` stays domain-local.
- The async entity-chip picker for `manager_id` (see above).
- Persisted localStorage/autosave drafts across a browser reload — the
  no-data-loss rule is about a failed submission, not a crash/reload, and
  no frozen document asks for the latter.
- Any backend changes — M3.6 builds entirely against the existing
  `AgentController::store` contract, verified during its own discovery
  pass. No backend code was touched.

**New backend findings, registered this milestone (verified from source,
not assumed):**

- **Positive finding** — `AgentController::store` correctly catches
  `ValidationException` before its generic handler; BC-N does **not** apply
  to it, mirroring the pattern already found on Clients' `assignBulk`. The
  one manual business-rule check (the essence/moto rule) also returns a
  properly `errors`-keyed 422, unlike Clients' equivalent gap (BC-X) — no
  special-casing was needed for it client-side.
- **Frozen-document inaccuracy, not a backend defect** — Design System §12
  states file uploads are capped at "images/PDF, 2MB documents, 5MB proofs."
  The real validator caps every single file field uniformly at 2MB; no 5MB
  tier exists anywhere in `store()` or `update()`. The UI states 2MB
  everywhere, accurately, not the document's claim.
- **Known, accepted permission-boundary gap** — `useManagerOptionsQuery`
  (Managers' own public surface) has no `enabled` gate, because its one
  prior caller (Commercials) shares `view-agents` with the endpoint it
  reads. This wizard is gated on `create-agent`, a *different* permission —
  a session holding `create-agent` without `view-agents` would 403 on the
  manager picker specifically. Documented in `identity-step.tsx`, not fixed
  — modifying Managers' public surface is out of this domain's scope.
- **Zero backend feature-test coverage** for `AgentController::store` —
  every finding above is read from source, not confirmed by an authoritative
  test suite.
- **A narrow, pre-existing backend sequencing risk, not introduced by this
  milestone** — `createMoto()` runs, and uploads its files, *before*
  `DB::transaction` wraps the agent insert. If the agent insert then fails
  inside the transaction, an already-created `Moto` row and its uploaded
  files would be orphaned. Not something the frontend can route around;
  recorded here so a future session doesn't rediscover it from scratch.
- **Untested outside this environment** — the real infrastructure's PHP
  `upload_max_filesize`/`post_max_size` have not been manually verified to
  accommodate up to 11 simultaneous file uploads in one request. An infra
  fact, not a code fact — needs a real-environment check during manual
  validation, not something readable from source.

**No new shared abstraction was introduced or extracted.** See the updated
Rule-of-Three tally below.

**Tests: 20 new tests** in `agent-onboarding-wizard-page.test.tsx`
(permission gating, wizard navigation, per-step validation, back-navigation
preservation, role switching, moto conditionals including the essence rule,
file validation, FormData payload shape, successful submission, success
screen/credential display, and failed-submission data preservation), plus 4
new tests across Managers'/Commercials' own list-page spec files (button
visibility + navigation to the wizard). One pre-existing test per list-page
file ("never offers a create action") was narrowed once a real, approved
create button existed — the same class of update M3.5 made to its own
"never offers bulk-assign" test, explained inline, not silent.

**Test environment limitation found and worked around, not hidden**: a
`FormData` containing a real `File` hangs indefinitely under this
MSW+jsdom test setup — reproduced independent of the implementation (even
via a raw `fetch()` call bypassing axios entirely). The submission tests
mock `httpClient.post` directly instead of going through MSW for this
reason; documented inline in the test file. This is a test-tooling gap, not
a product defect — nothing about the real browser/backend path is affected.

**Two real engineering findings, verified empirically, both already
commented at their point of use in code — not repeated as project-wide
rules**: react-hook-form reports an untouched native radio *group* as
`null` (not `undefined`), which the wizard's zod schema now models
correctly (`typeMoto: z.string().nullable().optional()`); and the
essence-field validation placement decision above.

**Test count at initial implementation: 431/431 across 24 files** (was
407/23 before M3.6 — the wizard's own spec file is the 24th). See "Follow-up
3/4/5" below for how this grew to its final, post-validation count.

## Follow-up 3 — City, Area of responsibility and Fuel Amount fixed from manual-validation review (first UX batch)

Manual UI validation of the wizard found three defects, all fixed in the
same pass, before the checklist continued:

- **`ville` and `villeActuelle` (Identity step) were still free-text
  inputs** — a drift from the pattern M3.2/M3.3/M3.4's own edit forms
  already established (Follow-up 1/2 above). Both are now `<select>`s
  sourced from `useVilleOptionsQuery` (Villes' existing public surface,
  unchanged), gated on `access-dashboard` via `enabled`, with the identical
  legacy-value-fallback handling Managers'/Commercials' own forms use. The
  payload is unchanged: still the city's NAME, not a Villes id.
- **`villeSousResponsabilite` (manager role) was a free-text input**,
  despite `ManagerAreaMultiSelect` already existing for exactly this field
  on Managers' own edit form. `ManagerAreaMultiSelect` is now exported from
  `managers/index.ts` (FTA §4 — a documented cross-domain coupling, the same
  pattern already used for `useManagerOptionsQuery`) and reused **unchanged**
  by the wizard — not a second implementation. The backend contract is
  identical to Follow-up 2's: one `", "`-joined string, ADR-0015 unchanged.
- **`montant_essence` ("Fuel Amount") lived on the Financial step
  unconditionally**, even though `AgentController::store` force-zeroes it
  for every combination except a GAS motorcycle. It now lives on the Moto
  step, rendered only when `hasMoto && typeMoto === "essance"`, with an
  effect that force-resets it to `"0"` the instant that condition stops
  holding — a nonzero value entered while Gas was selected can never be
  silently carried into an Electric or no-moto submission. The wire field
  name and payload are unchanged.
- **The Subscription Number label was renamed** to "Phone Subscription
  Number" — wording only. The backend field (`num_d_abonnement`) and payload
  are unchanged.

No backend changes. Tests: wizard spec net +1 (two stale essence-error tests
that assumed the old Financial-step field location were replaced by three
tests covering the new visibility/reset behaviour). Suite: 432/432 across 24
files.

## Follow-up 4 — Sector becomes a city-scoped select; Phone Subscription Number gets Moroccan-format validation (second UX batch)

Two more defects, found continuing the same manual-validation pass:

- **`secteur` (commercial role) was a free-text input.** It is now a
  `<select>` sourced from `useSecteursQuery({ villeId })` — the SAME hook
  `SecteursListPage`'s own city filter already uses, not a new
  implementation — where `villeId` is resolved from the operator's selected
  Current City NAME against the already-fetched Villes list.
  `useSecteursQuery` gained an optional `enabled` parameter (mirroring
  `useVilleOptionsQuery`'s own) and is now exported, alongside the `Secteur`
  type, from `secteurs/index.ts` — a **third** instance of the cross-domain
  picker-export pattern (see the updated Rule-of-Three tally below).
  Changing the Current City clears the selected sector and re-scopes the
  query automatically (the queryKey carries `villeId`); the select is
  disabled until a city is chosen. **The payload is unchanged**:
  `agents.secteur` still has no foreign key to `secteurs` (BC-V, unchanged),
  so the value submitted is still the sector's plain NAME, exactly what the
  free-text field used to send.
- **Phone Subscription Number accepted any string.** `AgentController::store`
  validates `num_d_abonnement` as a plain `required|string|max:255` — not as
  a phone number — so this is a deliberate, frontend-only tightening: the
  field now validates against the SAME Moroccan phone regex
  `ClientFormSheet` already uses for `phone`
  (`/^(\+212|0)[5-7][0-9]{8}$/`), duplicated locally in
  `model/agent-onboarding.ts` per ADR-0012 (validation schemas stay
  duplicated per domain), not imported. The backend payload and field name
  are unchanged.

No backend changes. Tests: 5 new (3 sector, 2 phone). Suite: 437/437 across
24 files.

## Follow-up 5 — Review step auto-submit defect, found and fixed (third UX batch, critical)

Manual validation found the most serious defect of the three rounds:
**reaching the Review step immediately submitted the agent**, with no click
on any confirmation control.

**Root cause**: the Moto→Review "Next" button and Review's own submit button
occupied the *same JSX position* in a ternary
(`{step === "review" ? <Button type="submit"> : <Button type="button">Next</Button>}`).
React reuses the same underlying `<button>` DOM node across that kind of
transition rather than unmounting/remounting it, so clicking "Next" caused
React to mutate that node's `type` attribute from `"button"` to `"submit"`
**in place**, synchronously, inside the very click handler that advanced
`stepIndex`. The browser evaluates "does this click submit the form?"
*after* synchronous handlers run, against the button's *current*
(already-mutated) `type` — so it saw `"submit"` and fired an implicit native
form submission the instant Review rendered. No second click was ever
involved.

**Fix**: no button in the wizard is ever `type="submit"`. Review's button
(relabelled **"Confirm and Create Agent"**) is wired directly to a
`handleConfirm` function via `onClick`, never to the browser's native submit
event; the `<form>`'s own `onSubmit` is now a no-op guard
(`event.preventDefault()` only), so even an implicit Enter-key submission
cannot create an agent.

**A second, related gap was found writing the regression test for this**:
guarding `handleConfirm` with `createMutation.isPending` alone is
insufficient against a duplicate request from two clicks landing in the same
synchronous tick — `form.handleSubmit`'s validation is asynchronous, so
`mutate()` (and therefore `isPending` actually becoming `true`) does not
happen until a later microtask, well after a second click has already
re-read the stale `isPending` captured at the last render. Closed with a
synchronous `useRef` guard (`submittingRef`), set `true` before `submit()`
is even called and released once it settles — a plain mutable value, not
subject to React's render-timing lag, which is the only thing a same-tick
second click can actually observe as changed.

No backend changes. Tests: 5 new, in a dedicated `describe("Review does not
auto-submit")` block, proving: no API call moving Motorcycle→Review; no API
call merely rendering Review; no API call clicking Back from Review; exactly
one API call clicking Confirm; no duplicate call from three rapid clicks
while pending. All 12 existing `/^create agent$/i` button-name assertions
were updated to the new label. Suite: **442/442 across 24 files** — the
milestone's final count.

## M4.1 — Money infrastructure (complete)

The first M4 sub-milestone: pure infrastructure, no Money domain code, per
explicit scope. Built from a full M4 discovery pass (architecture proposal,
domain boundaries, API inventory, business rules, risks and unknowns across
Cheques/Deposits/Debt Payments, verified from the live backend source, not
the roadmap's prose) run before any implementation. Manually reviewed and
validated before this close-out.

**`normalizeError` now recognizes a second envelope shape.** Verified from
source: `DepoController` and `DebtPaymentController` never emit `{message}`
on failure, only `{"error": "..."}` — every failure path in both
controllers confirmed, including both grattage-reconciliation domain
exceptions. The bare-status fallback now reads `body.error` when
`body.message` is absent (message still wins if both are present). Without
this, every Deposit/Debt Payment failure would normalize with no message at
all — this is not a per-domain workaround; normalization happens once,
centrally, in the axios interceptor, so there is no other place to fix it.
Three new tests pin the fallback, the precedence, and that a 422 with this
shape still classifies as `unknown`, never mistaken for a field-mapped
`ValidationException`.

**`FileUploadField` promoted from `agent-onboarding/` to
`shared/components/business/`, unchanged.** Rule-of-Three satisfied by
Money's three upcoming callers (Cheque photo, Deposit proof, Debt Payment
proof) — the exact reuse `phase8-architecture.html` §7 already named
("uploads Agent onboarding and Cheque submission both require"), not
invented ahead of a caller. The wizard's two call sites now import from the
shared location; nothing about its props or behavior changed.

**`StatusBadge` extracted** — Design System §17's full six-tone system
(neutral/warning/info/success/danger/muted), not the three call sites' own
minimal shape (a plain conditionally-muted `<span>`, byte-for-byte identical
across Managers/Commercials/Clients). Built to the richer spec deliberately:
Money's Cheques (pending/approved/rejected/annuler) and Deposits
(pending/validated/rejected) need tones Network's binary "active vs not"
never had to express, and extracting the minimal shape now would mean
redoing this component at M4.2. The component itself takes only `tone` +
`label` — it knows no status vocabulary (CLAUDE.md: no business logic in
`shared/`); each domain keeps its own `<Resource>_STATUS_TONES` map next to
its existing `<Resource>_STATUS_LABELS` map (`active`→success,
`blocked`→danger, `inactive`→muted, Clients' `pending`→warning, per §17's
own mapping table) and passes the result in. All three Network list pages
now render `<StatusBadge>` instead of their duplicated `<span>`.
**Colour implementation is direct Tailwind utility classes, not new CSS
custom properties** — the current theme (`index.css`) has only a neutral
shadcn palette plus `--destructive`; no `--success`/`--warning`/`--info`
tokens exist. Adding them felt like a larger, more visible design-token
decision than this task's scope; revisit if a later milestone wants proper
tokens.

**`MoneyAmount` extracted** — wraps `formatMoney`, adds `tabular-nums` and
the Design System §5 danger-color rule for negative values (which
`formatMoney` itself does not apply, being a pure string formatter). Takes
a `number`, not a string — deliberately narrower than "any money value in
the product": Managers'/Commercials' `avanceTotal` (a `bcadd`-computed
accessor string) and Clients' `solde` (a `decimal:2`-cast string) are BOTH
still carried and rendered verbatim, per their own models' existing
docblocks — parsing either back to a number would be the exact binary-
floating-point defect those docblocks already warn against. Only Products'
`value` (a genuinely numeric `decimal`-cast column) was swapped in; Money's
own Cheque/Deposit/Debt Payment `amount` fields (confirmed plain
`decimal(10,2)` columns, no accessor) are the real reason this was built
now, ahead of M4.2.

**`infrastructure/query/invalidation-map.ts` scaffolded, empty.** Mirrors
`infrastructure/errors/error-code-registry.ts`'s established shape exactly:
a frozen, empty registry (`INVALIDATION_MAP`), a lookup
(`queryKeyPrefixesFor`) and an apply function (`invalidateForEvent`) that
both degrade safely for an unregistered event — invalidating nothing,
never throwing, the same "unhelpful but safe" fallback the error registry
already uses. **No domain events registered**, by explicit instruction —
Money's first real event (`cheque.approved`) is M4.2's job, not this one's;
registering it now would be inventing a contract ahead of the mutation that
emits it.

**No backend changes, no Money domain code, no speculative abstractions.**
Every extraction was justified by Rule-of-Three evidence that already
existed (StatusBadge/MoneyAmount both already at ADR-0006's stated
threshold before M4.1 even started, per the tally below) or by named,
upcoming M4.2 callers (`FileUploadField`, the invalidation map) — nothing
was built for a hypothetical fourth or fifth caller.

**Tests:** 5 new (3 for the `normalizeError` fallback, 2 for the
invalidation-map scaffold, in its own new test file). No existing test
needed updating — every extraction changed markup/styling only, never
rendered text, and no test asserted on the replaced `<span>`'s structure or
class names. **447/447 across 25 files** (was 442/24), run twice standalone
to rule out FE-1 — stable both times.

## M4.2 — Cheques, Phase 1+2 (list, read-only) (complete)

The first Money resource, and the first resource outside Network. Built in
two phases, both scoped explicitly, not derived mid-implementation; a
dedicated implementation-level verification pass ran after Phase 2 and is
folded into this section rather than given its own heading.

**Phase 1 — domain model, API, queries (no UI, no routes, no permissions).**

- **`Cheque`/`ChequeAllocation`/`ChequeStatus`/`ChequeListParams`**, built
  from `ChequeController`/the `Cheque`/`ChequeAllocation` models/migrations
  re-read directly, not inherited from the M4 discovery report's prose.
- **A correction to M4.1's own stated assumption, caught before it shipped
  in the model**: `cheques.amount`/`cheque_allocations.amount` are
  `decimal:2`-cast columns, and Eloquent's decimal cast always serializes as
  a formatted STRING (`asDecimal()`'s `(string) number_format(...)`), never
  a JSON number. `MoneyAmount` (M4.1) was built partly anticipating Money's
  amount fields as its next real caller; they are not eligible. `amount` is
  typed `string` throughout and rendered verbatim wherever it appears — the
  same discipline `Manager.avanceTotal`/`Client.solde` already established.
- **`status`/`status_label` deliberately not modelled from the backend's own
  accessor** (ADR-0008) — `Cheque::getStatusLabelAttribute()`'s `rejetee`
  branch returns the raw constant string, not a real label, and every other
  branch is French-only. `CHEQUE_STATUS_LABELS`/`CHEQUE_STATUS_TONES` are a
  fresh, English, domain-owned pair, following every prior status enum's
  precedent — `CHEQUE_STATUS_TONES` mirrors Design System §17's own worked
  example for Cheques exactly (`en_attente`→warning, `accepter`→success,
  `rejetee`→danger, `annuler`→muted).
- **New backend finding, registered below as BC-Z**: `index()` computes a
  correct `processed_by_name` from a correctly-typed `processedByUser`
  relation, but `show()` eager-loads a *different*, mismatched relation
  (`processedBy(): belongsTo(Agent::class, 'processed_by')`, despite
  `processed_by` storing a **User** id) — Eloquent's array serialization
  then overwrites the raw `processed_by` FK with that relation's (likely
  null or wrong) result. Left unmapped until raised with the backend; not
  something a frontend mapper can paper over.
- **Query keys stay flat** (`["cheques", ...]`), matching every existing
  resource's factory (Villes, Secteurs, Products, Admins, Managers,
  Commercials, Clients — four-for-four of the paginated ones), **not**
  FTA §8's own worked example, which writes Money keys as
  `[domain, resource, ...]`. A real discrepancy between the frozen
  document's prose and unanimous codebase precedent, raised rather than
  silently resolved either way — `invalidation-map.ts` entries in Phase 3
  must invalidate the prefix `["cheques"]` accordingly.
- **`useChequesQuery`/`useChequeQuery`, `LIVE` tier**, `refetchOnWindowFocus:
  true` — FTA §8 names pending cheques explicitly under this tier, and the
  plain list is the same class of concurrently-edited data. Read-only; no
  mutations.

**Phase 2 — permissions, routing, list page, DataTable/FilterBar extraction.**

- **All six Cheque permissions registered** (`view-cheques`,
  `view-pending-cheques`, `create-cheque`, `approve-cheque`, `reject-cheque`,
  `annuler-cheque`) — together, ahead of their individual UI controls,
  because the whole set was verified from source as one stable vocabulary
  during the M4 discovery pass (unlike Clients' still-undecided extras).
  Only `VIEW_CHEQUES` gates a control this phase: the route and the list.
- **`DataTable` and `FilterBar` extracted to `shared/components/business/`**
  — a real decision point flagged since M3.4, resolved explicitly rather
  than by accident: the user was asked "extract now, or build Cheques' own
  inline table/filters" and chose extraction. Both are genuine Rule-of-Three
  extractions from FOUR working screens' byte-identical markup (Villes,
  Managers, Commercials, Clients), not invented ahead of evidence.
  `DataTable` is headless (structure only — no sort/pagination/loading
  logic, which stay the caller's `ListPage`/state, matching every existing
  screen). `FilterBar`/`FilterField` extract only the proven wrapper shape,
  not a config-driven filter system. **Villes/Managers/Commercials/Clients
  were deliberately NOT retrofitted onto them this phase** — that migration
  is separate and larger, and out of scope here.
- **The Cheques list page**: search, status filter, a merged Agent filter,
  and a submitted-date range, against `useChequesQuery`. `amount` renders
  **verbatim, not through `MoneyAmount`** — despite the task's literal
  instruction to reuse it — because Phase 1 corrected the amount-is-a-string
  assumption `MoneyAmount` was partly built for; the page's own docblock
  records why. Pagination, loading/error/empty states all reuse the
  existing `ListPage`/`ListLoadingState`/`ListErrorState`/`ListEmptyState`
  patterns unchanged.
- **`ChequeAgentFilter` merges two existing pickers** (`useManagerOptionsQuery`
  + `useCommercialOptionsQuery`) into one `<select>`, rather than inventing a
  cross-role search endpoint — no backend endpoint searches both roles at
  once (verified during M4 discovery). **A third, distinct cross-domain
  pattern**, not conflated with the picker-*export* tally below (Cheques
  exports nothing new for a further consumer; it *consumes* two existing
  exports and merges them in one component) — recorded here as its own
  instance, the same way `ManagerAreaMultiSelect`'s reuse was at M3.6.
  **Two disclosed, known gaps, not silently worked around**: the Commercial
  half is `status=active`-only (M3.5's own scoping decision, inherited
  as-is), so a blocked/inactive commercial's historical cheques are not
  findable through this filter; and the Manager half has no `enabled` gate
  (the same pre-existing, accepted gap M3.6's wizard already carries), so a
  session holding `view-cheques` without `view-agents` 403s on the Manager
  half specifically.
- **New instance of the BC-P defect class, narrower than Managers'/
  Commercials' own**: `ChequeController::index` uses `whereDate()`
  (correctly day-inclusive) when only ONE of `date_from`/`date_to` is
  given, but `whereBetween()` against the raw `created_at` timestamp
  (excluding most of `date_to`'s own day) when BOTH are given together.
  "Submitted before" stays the honest label — exact when both filters are
  set together, harmlessly conservative when `date_to` is used alone.
- **Routing**: `/money/cheques`, gated on `view-cheques`, no children
  (ADR-0014/FE-2, same reasoning as every prior domain). **Nav entry
  added** — the first entry in a new "Money" group, English label
  (deliberate — see the inline comment on O-1/the M3.x precedent).

**Implementation-level verification pass (post-approval, pre-close-out)** —
requested explicitly because there is currently no way to create a cheque
through the UI or seed one, so a real browser end-to-end pass could not run
yet:

- **One genuine gap found and fixed**: `route-authorization.test.tsx`'s
  parametrized `domainPaths` array — the mechanism by which every new
  domain route automatically inherits refuses-without-permission/redirects-
  when-unauthenticated coverage — did not include `CHEQUES_PATH`. Added; both
  parametrized cases now run and pass for `/money/cheques`.
- **A new `cheques-list-page.test.tsx`** (24 tests, MSW-integration style,
  matching the convention every other list page already has) covering the
  envelope contract, loading/error/empty states, all four filters and their
  exact wire parameter names (confirming `statute`, not `status`, is what
  actually gets sent), the merged agent picker's sort order and gating,
  pagination, and the row-mapping facts above (`amount` verbatim, all four
  status labels/tones, `formatIdentifier`/`formatDate` usage).
- **Full file-by-file review of every Phase 2 file** (plus Phase 1's, since
  Phase 2 depends on them) found no other genuine defect: no duplicated
  logic, no speculative abstraction, no permission mistake, no dead code
  beyond one stray fragment already self-caught and fixed before this
  review began.

**No backend changes. No mutations, no submit form, no pending queue, no
approve/reject/annuler, no detail page** — all Phase 3.

**Tests: 26 new** (2 more parametrized `route-authorization` cases +
24 in the new `cheques-list-page.test.tsx`). **473/473 across 26 files**
(was 447/25 after M4.1), run twice standalone to rule out FE-1 — stable
both times.

## M4.2 — Cheques, Phase 3A (creation) (complete)

The Create Cheque workflow — the first Cheques mutation, and the first
mutation of any kind in the Money domain.

**A backend contract mismatch was found and corrected BEFORE writing any
code**, not discovered mid-implementation: the field list this phase was
first given (Agent, Amount, Cheque Number, Bank, Issue Date) was checked
directly against `ChequeController::store`'s validator, the `cheques`
migration and the `Cheque` model's `$fillable` — none of the three contains
a `banque`/`date_emission` (or any bank/issue-date) column, fillable entry,
or validator rule. Per ADR-0009 (expose only backend-supported
capabilities), Bank and Issue Date were dropped from scope rather than
built as dead fields. The same check also found the requested list OMITTED
`photo_cheque`, which the backend requires (`required|image|mimes:jpeg,png,jpg|max:2048`)
— without it every submission would 422. Confirmed with the user before
implementing either correction (per this phase's own explicit "stop and ask
on contract ambiguity" instruction), not silently resolved either way. The
form ships with exactly the four backend-supported fields:

```
'agent_id'     => 'required|exists:agents,id',
'amount'       => 'required|numeric|min:0.01',
'num_cheque'   => 'required|string|max:255|regex:/^[A-Za-z0-9_-]+$/|unique:cheques,num_cheque',
'photo_cheque' => 'required|image|mimes:jpeg,png,jpg|max:2048',
```

**A second, smaller contract fact caught while writing the mapper, not
assumed from resemblance to `index()`/`show()`**: `store()`'s success
response nests `photo_url` as a SIBLING of the raw cheque object —
`data: {cheque: {...}, photo_url: "..."}` — rather than spreading it INTO
the cheque object the way `index()`/`show()` both do (`[...$cheque->toArray(),
'photo_url' => ...]`). Passing `data.data.cheque` straight into the
existing `toCheque()` mapper would have silently produced a `null`/missing
photo URL on the cheque this page just successfully created. `cheques-api.ts`'s
`createCheque()` now explicitly merges the two (`{...data.data.cheque,
photo_url: data.data.photo_url}`) before mapping — the anti-corruption
layer (ADR-0006/D-6) absorbing a per-endpoint envelope inconsistency at the
domain's own boundary, exactly as the layer is meant to.

**Implementation:**

- **`createChequeSchema`** (new `model/create-cheque.ts`) mirrors the
  backend validator field-for-field: required + numeric + `min:0.01` for
  amount, the exact `^[A-Za-z0-9_-]+$` regex for the cheque number, and a
  required-file check (2MB cap, JPEG/PNG only) for the photo — no validation
  beyond what the backend itself enforces.
- **`CreateChequeAgentField`** merges the same two picker exports
  `ChequeAgentFilter` (Phase 2) already merges, but is its OWN component,
  not a generalization of that one: a filter's "" is a permanent, valid
  state ("all agents"); a create field's "" must resolve to a real id before
  submit. Two call sites with different value semantics is below this
  codebase's Rule-of-Three threshold, so the ~15-line merge/sort stays
  duplicated rather than being unified early.
- **`CreateChequePage`** is a plain single-step form — `type="submit"` +
  `disabled={isPending}`, no extra submit-guard ref. This deliberately does
  NOT reuse the M3.6 wizard's `type="button"`-everywhere pattern: that fix
  addressed two buttons sharing one JSX ternary slot across a step
  transition (a real DOM-node-reuse bug); this form has exactly one button
  in one position, so the hazard doesn't exist here. Instead it follows
  `FormDrawer`'s own shape — the convention every other create/edit form in
  this product already uses.
- **No toast library exists anywhere in this codebase** (verified by a
  full-codebase search, not assumed from a comment describing one — two
  M3.6 wizard comments describe a "toast-and-navigate" convention as the
  product norm, but no real implementation backs that claim anywhere).
  Adding one for this form would be a new dependency without the
  justification CLAUDE.md requires. On success, the page navigates to the
  Cheques list — mirroring "if other resources redirect to the list page
  after creation, do the same" — where the newly invalidated, refetched
  list shows the new cheque as the same implicit confirmation every
  `FormDrawer` save already relies on. On failure: a `role="alert"` banner
  (mirroring `ManagerFormSheet`'s exact pattern) plus per-field 422 mapping
  for all four fields, and every entered value — including the chosen file
  — is left exactly as it was.
- **Cache invalidation goes through `invalidateForEvent`** (M4.1's
  `invalidation-map.ts` scaffold), not a local `queryClient.invalidateQueries`
  call — the FIRST real caller of that mechanism in the product.
  `"cheque.created"` is registered invalidating only `[["cheques"]]`,
  deliberately narrower than the `cheque.approved`/`cheque.annuled` events
  `next-session.md` already plans (which also invalidate Network's
  Managers/Commercials prefixes): creating a cheque adds a new `en_attente`
  row but touches no `agent.solde`/`montant_avance_*` column, so nothing
  outside Cheques' own key space needs busting yet.
- **Routing**: `CHEQUES_NEW_PATH` (`/money/cheques/new`), gated on
  `create-cheque` — its own permission, separate from the list's
  `view-cheques`, mirroring the backend's own separate check on
  `POST /admin/cheques`. Two flat sibling routes now share `chequesRoutes`
  (the first Money route array to hold more than one) — not nested
  `children`, same ADR-0014/FE-2 reasoning as every prior domain. A "Create
  Cheque" button was added to the list page's `action` slot, gated on the
  same permission, mirroring Managers'/Commercials' own "Create..." buttons
  that navigate to the Agent Onboarding wizard. **No nav entry** — matches
  the wizard's own explicit "reached only via a list-page button" decision.
- **`route-authorization.test.tsx` gained `CHEQUES_NEW_PATH`** in its
  parametrized coverage array, alongside `CHEQUES_PATH` — the same
  discipline applied to the Phase 2 close-out review, applied immediately
  this time rather than left as a gap to find later.

**No backend changes. No pending queue, no approve/reject/annuler, no
detail page, no edit, no delete, no bulk actions, no attachments, no
comments** — all Phase 3B or later.

**Tests: 16 new** (14 in the new `create-cheque-page.test.tsx`, covering
rendering, all four validation rules, the merged agent picker and its
`view-agents` gating, the exact multipart wire field names, the pending/
disabled state, success navigation, Cancel, general-error/field-level-422/
permission-error handling; 2 more parametrized `route-authorization` cases
for `CHEQUES_NEW_PATH`). **489/489 across 27 files** (was 473/26 after
Phase 2), run twice standalone to rule out FE-1 — stable both times.

## M4.2 — Cheques, Phase 3B (pending queue + detail page) (complete)

The Pending Cheques queue and the Cheque Detail page — the first detail
page shipped anywhere in this product (ADR-0014 deferred every Network
detail page pending FE-2; Cheques is the first resource to actually ship
one).

**Backend contract re-verified fresh from source before implementing**
(`ChequeController::pending`/`show`, the routes, the permission registry),
not carried forward from the earlier M4 discovery pass unchecked. Confirmed
unchanged from that pass: `GET /admin/cheques/pending` (`view-pending-
cheques`) accepts NO filters at all — no `$request->validate()` call
exists in `pending()` — only `page`/`per_page` are ever meaningful; `GET
/admin/cheques/{id}` (`view-cheques`) eager-loads `agent`, `processedBy`,
`allocations` and manually adds `photo_url`/`status_label`.

**Two real scope questions were raised and resolved with the user before
any code was written**, because this session's own task instructions
diverged from what the frozen architecture doc and the prior session's own
plan (in `next-session.md`) called for:

1. **Pending Cheques page**: the frozen doc names a shared `ApprovalQueuePage`
   pattern for this screen ("ListPage variant defaulted to status=pending
   with inline approve/reject"), and the prior plan called this phase its
   "first instance." **Decided: reuse `ListPage`/`DataTable` directly, no
   new shared pattern** — CLAUDE.md's own anti-premature-abstraction rule
   (Rule-of-Three, "never on reuse count alone") outweighs a doc's naming
   when there is exactly one real consumer and the endpoint accepts no
   filters at all (so there is nothing "actionable" a queue-specific shell
   would add over a plain list, absent the approve/reject buttons this
   phase deliberately excluded — see Phase 3C).
2. **Cheque Detail page**: the frozen doc names a shared `DetailPage`
   pattern too, never built (ADR-0014 deferred it). **Decided: a
   domain-local page, not a new shared pattern** — same Rule-of-Three
   reasoning, one consumer today. Extract a shared `DetailPage` once a
   second resource (Deposits/Debt Payments, or a future Network detail
   page) genuinely needs the identical header + facts + body shape.

**Implementation:**

- **`PendingChequesPage`** — no `FilterBar` at all (the endpoint supports
  no filters; exposing controls the API ignores would misrepresent the
  system, per `session-bootstrap.md`'s own working principle), a "View"
  action column navigating to the detail route. `usePendingChequesQuery`
  is `LIVE`-tier, `refetchOnWindowFocus: true` — same tier as the general
  list (FTA §8 names "pending cheques" explicitly under this tier).
- **`ChequeDetailPage`** displays every field `show()` returns that the
  domain model already maps: id, amount (rendered verbatim, never through
  `MoneyAmount` — same `decimal:2`-cast-string discipline as the list
  pages), numCheque, status, agentName, photoUrl (an `<img>` when present,
  nothing fabricated when absent), decisionReason, processedAt, createdAt,
  allocations (only when populated — `undefined`, never an empty array,
  stands for "not fetched"). **Deliberately does NOT display a "processed
  by" name** — BC-Z (`show()` eager-loads the wrong relation for
  `processed_by`, overwriting the raw FK with a mismatched result) means
  the field cannot be shown correctly; left unmapped rather than guessed
  at or shown wrong.
- **Routing**: `CHEQUES_PENDING_PATH` (`/money/cheques/pending`, gated on
  its own `view-pending-cheques` permission) and `CHEQUE_DETAIL_PATH`
  (`/money/cheques/:id`, gated on `view-cheques`, the SAME permission as
  the list route) — both FLAT SIBLING routes, not nested `children`, the
  same ADR-0014/FE-2 reasoning `CHEQUES_NEW_PATH` already established. A
  "View" action was added to the main Cheques list too, so the detail page
  is reachable from both list screens. A "Pending Cheques" nav entry was
  added (its own screen, unlike Create/Detail which are reached via
  in-page buttons/links).
- **`useChequeQuery` gained an `enabled` option** — guards a malformed
  `:id` route param (a hand-edited URL) from firing `GET
  /admin/cheques/NaN`, the same pattern `useCommercialOptionsQuery({
  enabled })` already established.

**Tests: 44 new** across two new files — `pending-cheques-page.test.tsx`
(15 tests: rendering, the flat-paginator contract, no-filter-params
assertion, loading/empty/error states, pagination, View navigation) and
`cheque-detail-page.test.tsx` (29 tests at this point: every field
rendered, loading/not-found/error states, an invalid-id guard) — plus
route-authorization coverage for both new paths and a View-navigation test
added to the existing Cheques list test file. **520/520 across 29 files**
(was 489/27 after Phase 3A).

## M4.2 — Cheques, Phase 3C (approve/reject/annuler) (complete)

Approve, Reject and Annuler — the three remaining Cheques status actions,
completing the workflow. Shipped in **two passes within the same session**,
because the scope for Approve changed partway through.

**Backend contract re-verified fresh from source** (`ChequeController::
approve/reject/annuler`, the routes, the permission registry) at the start
of this phase, and AGAIN, independently, when Approve's scope was
corrected mid-phase — not assumed from the first pass's own notes.

### Pass 1 — plain confirmations (all three actions)

Two scope questions, both explicitly raised and resolved with the user
before writing code (the prior session's own plan had explicitly left both
open, pending confirmation):

1. **Should Approve include the allocation-split sub-form** (rapped vs.
   grattage) **or ship a plain confirm**, accepting the backend's own
   legacy default (100% rapped, sent as no `allocations` body at all)?
   **Decided (Pass 1): plain confirm** — matches "reuse `ConfirmActionDialog`,
   do not redesign the dialog system," and a dynamic allocation form was a
   materially larger, separate feature.
2. **Where should the three action buttons live** — the Cheque Detail page
   only, or also as inline row actions on the Pending Cheques list (as the
   frozen doc's `ApprovalQueuePage` description implies)? **Decided: Cheque
   Detail page only** — keeps the scope contained to the one screen
   already built to show full context before a financial decision.

**Implementation (Pass 1):** `ApproveChequeDialog`/`RejectChequeDialog`/
`AnnulerChequeDialog`, each wrapping `useApproveChequeMutation`/
`useRejectChequeMutation`/`useAnnulerChequeMutation`. `ConfirmActionDialog`
was extended (not forked) with:

- **`variant`** (`"destructive"` default, unchanged for all 8 existing
  callers; `"default"` for Approve) — resolves the previously-flagged
  blocker ("hardcoded `variant="destructive"`... needs a decision before
  Approve specifically can use it").
- **`reason`** — a labeled, validated textarea slot (label, value,
  onChange, field-mapped error), for Reject/Annuler's own required
  `decision_reason` (`required|string|max:1000` server-side). No prior
  caller needed a free-text input; recurring identically across two real
  callers met the "genuinely required" bar for extending the shared
  component rather than embedding an uncontrolled field in `description`.

Buttons are gated on BOTH permission AND the cheque's current status
(Approve/Reject only while `en_attente`, Annuler only while `accepter`) —
the same "don't offer a guaranteed backend no-op" precedent
`ManagerStatusDialog` already established. `cheque.approved`/
`cheque.rejected`/`cheque.annuled` were registered in `invalidation-map.ts`:
`approved`/`annuled` invalidate `["cheques"]` plus both `["managers"]`/
`["commercials"]` prefixes (approval/annulment write
`montant_avance_rapped`/`montant_avance_grattage`/`solde`, the same
columns those lists render as `avanceTotal`); `rejected` invalidates only
`["cheques"]` (touches no balance column, confirmed from source).

### Pass 2 — Approve's allocation split (scope corrected)

**The user re-verified the backend contract again and found Pass 1's
"simple confirm" decision for Approve no longer matched the actual
requirement** — Approve now needed to support the allocation split after
all. Re-reading `ChequeController::approve`'s validator surfaced the
load-bearing fact that made this a genuine re-derivation, not just "add
two inputs":

```
'allocations'          => 'sometimes|array|min:1|max:2',
'allocations.*.type'   => 'required_with:allocations|in:rapped,grattage',
'allocations.*.amount' => 'required_with:allocations|numeric|min:0.01|decimal:0,2',
```

**`min:0.01` REJECTS a zero-value allocation entry outright (a 422) — it is
not merely redundant to send one.** A 100%-rapped split is therefore
`[{type:"rapped", amount}]`, the zero (`grattage`) side OMITTED entirely,
never sent as `{type:"grattage", amount:0}`.

**Implementation (Pass 2):** `ApproveChequeDialog` rebuilt with a read-only
cheque amount plus two plain `<Input>`s (Rapped, Grattage — no dynamic
rows, no add/remove), defaulting to 100% rapped (reproducing the backend's
own legacy shape when left untouched). Validation is CENTS-SAFE, not
floating point: `toCents()` converts each amount string to an integer
number of cents before summing/comparing, mirroring the backend's own
`bcadd`/`bccomp` exactness rather than risking a binary-floating-point
mismatch on a financial value. `buildAllocations()` omits whichever side
is zero. `ConfirmActionDialog` gained two more generic extensions to make
this possible without forking a parallel dialog:

- **`confirmDisabled`** — a plain boolean the caller computes from its own
  validation ("rapped + grattage must equal the cheque amount exactly");
  domain-agnostic on purpose, since a cheque-shaped prop would leak
  business logic into `shared/`.
- **`children`** — block-level custom content rendered OUTSIDE
  `SheetDescription`'s `<p>`, added after a REAL invalid-HTML-nesting
  console warning surfaced from the first attempt (nesting `<div>`s/`<p>`s
  inside `description`, which Radix renders as a `<p>`) — not a
  speculative addition.

`useApproveChequeMutation`'s variables changed from a bare `id` to
`{id, allocations}`; the mutation itself, and its `"cheque.approved"`
invalidation, are otherwise unchanged — only the payload shape changed, per
this pass's own explicit scope.

Along the way, a React `react-hooks/set-state-in-effect` lint error (from
seeding the two input fields' defaults via `useEffect`) was fixed properly
— an "adjust state during render" pattern (React's own recommended
approach for resetting state when a prop's identity changes on an
already-mounted component) — rather than suppressed.

**Tests:** Approve's test block was rewritten to cover the new behavior:
defaults to 100% rapped untouched, a valid split, 100% grattage, invalid
total under the cheque amount, invalid total over it, and a non-numeric
input — all client-side-disabled before submission, per this phase's own
"do not allow submission unless the total matches exactly" requirement.
Reject/Annuler's own tests (reason-required gating, field-mapped 422s,
success/failure, cache invalidation) were unaffected by the Pass 2
correction and needed no changes. **548/548 across 29 files** (was 520/29
after Phase 3B).

**No backend changes.**

## M4.3 — Deposits (complete)

The second Money resource, built in four phases (list, detail page,
validate/reject, creation), each its own commit
(`dcb8380`/`6ab02a5`/`a64f42f`/`4dd4d63`). Backend contract re-verified
fresh from source at the start of the milestone, not carried forward from
the M4 discovery pass unchecked — the backend had changed underneath that
pass (`DepoResource`, commit `8786326`, unified `index()`/`show()`/`store()`
onto one shape and added `reject_reason`/`validated_by`/`validated_at`/
`bank_name`/`proof_type`).

**`Deposit.amount` IS A REAL NUMBER** — `DepoResource` casts it
`(float) $this->amount`, unlike `Cheque.amount`'s `decimal:2`-cast string.
This is the first genuine Money caller of `<MoneyAmount>` (M4.1's own
docblock named this ahead of time, then Cheque turned out not to qualify).
**`date`/`validatedAt` are `Y-m-d H:i`, NOT ISO-8601** — normalized to
ISO at the mapper boundary before reaching `shared/formatters`, a genuine
divergence from Cheques'/Debt Payments' own plain-ISO timestamps.
**`validatedByName`/`validatedAt` populate for a REJECTED deposit too, not
only a validated one** — `DepositService::reject()` also sets
`validated_by_admin`/`validated_at`; the column names are simply
misleading ("who/when processed this", not literally "validated"). `type`
(`rapped`/`grattage`) is set once at creation and never transitions —
rendered as plain text, never through `StatusBadge`, which is reserved for
the real `status` lifecycle (`pending`/`validated`/`rejected`).

**No shared `DetailPage` pattern was extracted** — same Rule-of-Three
reasoning Cheques' own detail page already established; two consumers
(Cheques, Deposits) still short of three. **`index()` has NO `perPage`,
sort, or date-range parameter** — `paginate(20)` is hardcoded server-side;
`DepositListParams` carries none of these, exposing no control the API
would ignore. The freshness rule (`useFreshConfirm`, see below) was
retrofitted onto Deposits' own validate/reject dialogs in the same phase
that built it, not left for a later pass.

**No backend changes.** Tests grew across all four phases; the milestone's
own final count is folded into the freshness-rule retrofit's count below
(both landed in adjacent commits within the same session).

## M4.4 — Debt Payments (complete)

The third and final Money resource — `list + submit` only, the simplest of
the three by a wide margin. **`admin_id` -> `User`, NOT `Agent`** — the one
genuine structural difference from Cheques/Deposits: this screen is about
the LOGGED-IN ADMIN's own debt to the company (accrued, among other ways,
by Deposits' own rapped+cash-method side effect on `currentAdmin->debt`),
not a cross-admin management list. `index()` hard-scopes every query to
`Auth::user()` — there is no `admin_id` filter anywhere, confirmed from
source, so this is inherently self-service.

**No `status`, no `type` column exists on this model at all** — no
lifecycle, so no `StatusBadge` anywhere on this screen. **`show()`/
`destroy()` are both commented-out dead routes** (confirmed from source),
so there is no detail page and no delete UI to build. `amount` is a
`decimal:2`-cast string (Cheques' discipline, not Deposits'); `created_at`
is plain ISO-8601 (Cheques' shape, not Deposits' `Y-m-d H:i`) — a genuinely
different pairing of the two prior resources' own conventions, re-verified
independently rather than assumed to match either one.

**The list response carries two summary scalars alongside the paginated
rows** — `current_debt` (`$admin->debt`, the same string the create form's
own ceiling check reads) and `total_paid` (a plain SQL `SUM`, coerced with
`String(...)` at the mapper boundary since the driver's own numeric-vs-
string return shape was not captured live). This is the first Money list
response parsed that carries extra scalar context beyond the page itself.
Both `debt_cash` (list) and its create counterpart share the IDENTICAL
permission string, verified from source (`routes/api.php:167-170`) — a
genuine divergence from Cheques'/Deposits' own split view/create
vocabularies, mirrored rather than invented.

**No backend changes.**

## Freshness-rule retrofit — `useFreshConfirm` (M4 · "Gate G4" closure)

FTA §8's freshness rule ("data that gates an irreversible action is
refetched immediately before that action is confirmed... if the refetch
reveals the record changed underneath them, the dialog MUST say so and
refuse") had NOT yet been implemented anywhere — every Money confirm
dialog through M4.3 submitted directly against whatever was already in the
cache. This phase built `useFreshConfirm` (`shared/hooks/`) and retrofitted
it onto all five existing irreversible-action dialogs: Cheques' Approve/
Reject/Annuler and Deposits' Validate/Reject.

**Extracted immediately, at two domains, not deferred to a third caller —
see ADR-0018** for the full reasoning (a frozen document's own mandate,
not a UI shape discovered by repetition). **Each dialog's freshness query
uses its OWN, distinct cache key**, never the host page's own detail query
key — sharing would let a transient verification failure flip the host
page's own display into an error state too, confirmed empirically while
building this retrofit (see `useFreshConfirm`'s own docblock, and every
`*FreshnessQuery` hook's, for the concrete mechanism).

**No backend changes.** This retrofit is presentation/state-machine
plumbing only — no dialog's business rule (which status transitions are
valid, what "stale" means for that resource) changed.

## M5 discovery — Stock domain (Bons, Allocations, Agent Transfers, Agent Stock Returns)

A full discovery pass across all four Stock movement types, run before any
M5 implementation, per the same discipline every M3/M4 milestone required.
Produced an approved implementation plan with five explicit decisions:
build order Agent Stock Returns → Agent Transfers → shared-component
extraction → Allocations → Bons; extract `LineItemsEditor` at day one
(justified by a verified, contract-proven line shape identical across all
four types — not reuse-count speculation, see ADR-0019); hide any create
form still blocked on a missing backend capability behind a feature flag
rather than shipping a dead control; keep error-code copy English
(consistent with every domain so far, O-1 still formally unsigned); and
raise three backend consultation items rather than route around them:
Companies/Suppliers controllers do not exist (blocks the Stock directory
screens, not the four movement types — B-1, carried unchanged since M0),
no stock-quantity read endpoint exists anywhere (no screen can show a
live stock level; both `AGENT_TRANSFER_EXCEEDS_CAPACITY`'s capacity check
and every `*_STOCK_INSUFFICIENT` refusal are therefore handled reactively,
never with a proactive hint), and only Bons has a `/cancel` route today —
Allocations/Agent Transfers/Agent Stock Returns have no cancellation
lifecycle at all, confirmed from `routes/api.php`, not assumed absent.
`gh` CLI is unavailable in this environment, so these three items were
drafted as text for the user to file manually rather than created as real
GitHub issues.

## M5 Phase 1 — Agent Stock Returns (complete)

The first Stock resource, and the first resource whose failures carry a
documented, machine-readable `code` from day one (`error-code-registry.ts`
gained its first 13 real entries here — every prior domain's own dialog
hand-rolled its copy because none of its failures carried one).
Draft → add lines → irreversible validate, mirroring the shape all four
Stock movement types share; **no cancel** (verified from source — only
Bons has that route). Manager→Commercial cascading picker
(`ReturnManagerCommercialField`) guarantees `commercial.manager_id ===
manager_id` BY CONSTRUCTION (the Commercial select is populated from
`GET /admin/agents/{manager}/sub-data`, scoped to the chosen manager), so
the binding is never re-checked client-side — the real check is the
backend's own, re-asserted again under a row lock at validate time.

`montant` is METADATA-ONLY (`SUM(line.unit_cost * line.quantity)`,
recomputed server-side on every line write) — it gates nothing; the real
gate is the commercial's stock floor, checked only at validate. `LineItems
Editor` (ADR-0019) was extracted here, at its first caller. Manually
validated against the real running backend this milestone; every issue
validation found was fixed before close-out.

**No backend changes.**

## M5 Phase 2 — Agent Transfers (complete)

The second and (for now) final Stock resource before the roadmap's
approved shared-extraction pass. Structurally mirrors Agent Stock Returns
(same draft → add lines → validate lifecycle, same `LineItemsEditor` and
`useFreshConfirm` reuse, same FormRequest-gated permission posture — no
route middleware, confirmed from source) but its own contract was
re-verified fresh, not derived mechanically from Return's (ADR-0022):

- **15 error codes registered explicitly**, not a `RETURN_` → `TRANSFER_`
  rename — two have no Return equivalent at all
  (`AGENT_TRANSFER_EXCEEDS_CAPACITY`, a live grattage-capacity gate;
  `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`, the Grattage restock
  gate — Phase 5.10 §2.9 — surfaced reactively now, with the proactive hook
  an explicit M6 Grattage deliverable, not built here), and one superficially
  resembles Return's own but carries a genuinely different string
  (`TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID` vs. `RETURN_MANAGER_ROLE_
  INVALID` — a `RECIPIENT_` infix Return's equivalent does not have).
- **`validation_summary`'s own keys genuinely diverge from Return's** —
  `{line_count, total_quantity, montant}`, not Return's `{total_lines,
  total_quantity, total_montant}` — verified directly from
  `AgentTransferResource::toArray()`.
- **`VIEW_AGENT_TRANSFERS` is PLURAL** (`view-agent-transfers`), copied
  verbatim from the backend constant — Return's own equivalent is
  singular. Eight permissions total, mirroring Return's own count.
- **The Manager→Commercial cascading picker is its own, domain-local
  copy** (`TransferManagerCommercialField`), not shared with Return's —
  Allocation's own binding rule was independently re-verified to use a
  completely different counterpart pair (`company_id` +
  `agent_id(role=manager)`, no manager↔commercial relationship at all), so
  this pattern has a confirmed ceiling of two consumers and will not reach
  a Rule-of-Three extraction (ADR-0021).
- **No proactive capacity hint was built** — `AGENT_TRANSFER_EXCEEDS_
  CAPACITY` is handled reactively, by explicit decision; capacity stays a
  backend-owned rule until a real read endpoint exists (see the M5
  discovery section above).

Implementation-level verification (typecheck/lint/format/build/full test
suite) is complete and green; manual validation against the real running
backend is still owed (see "Current milestone" above).

**No backend changes.**

## M5 Phase 4 — Allocations (complete at the implementation level; manual validation blocked)

The fourth Stock resource, and the first whose own discovery pass (not
this document — done live at the start of this phase) found a genuinely
different shape from Return/Transfer, not a variation on it (ADR-0022):

- **The binding pair is `company_id` + `agent_id` (role=manager)** — no
  manager↔commercial relationship at all, confirmed independently by both
  Return's and Transfer's own discovery passes (ADR-0021) and re-verified
  here. There is therefore **no cascading picker** — the create form's
  Company and Manager selects are two plain, independent fields.
- **`montant` is LOAD-BEARING**, diverging from both Return's and
  Transfer's own metadata-only `montant`: it drives a real deposit-capacity
  gate at validate time (`StockService::validateAllocation`, FIFO-drawn
  against the manager's validated grattage deposits).
- **Two validate-time gates with no Return/Transfer equivalent**:
  `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` (the capacity check above) and
  `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` (Phase 5.10 §2.9's restock
  gate — refuses if ANY commercial under the recipient manager has an
  undischarged grattage obligation, not just the manager). Both handled
  reactively only, same restraint as Transfer's own capacity/obligation
  gates (no proactive hint — BC-AA).
- **10 error codes, fewer than Return's 13 or Transfer's 15** — a genuine
  contract fact, not an incomplete registration: the binding pair is
  validated by plain FormRequest `exists()` rules, so there is no
  role-mismatch/inactive/binding-drift exception family the way
  Return's/Transfer's own recipient checks have.
- **No "Consumptions" (deposit-funding) UI** — verified from source that
  `AllocationController::show()` never eager-loads the `consumptions`
  relation; only `validateAllocation()`'s own response does. A field
  reliably absent on every subsequent read (including a page reload right
  after validating) is not modelled or rendered anywhere (ADR-0008).

**A new backend capability was needed and added this phase**:
`GET /admin/companies` — read-only, unpaginated, `access-dashboard`,
filtered to `active=true`, `{id, name, code, active}`, mirroring
`SecteurController::index()`'s own minimal shape byte-for-byte. Companies
(and, later, Suppliers for Bons) are **seeded reference data, not
dashboard-managed entities** (`Phase4ASeeder`) — no CRUD endpoint exists or
was built; a full create/edit/delete surface was explicitly considered and
rejected as unnecessary scope. The frontend counterpart,
`domains/reference/companies/`, is deliberately narrower than Villes/
Secteurs/Products: model/api/queries/index only, no list page, no routes —
Companies has nothing for the app router to assemble because there is no
screen to manage it from. `useCompanyOptionsQuery` feeds both the
Allocation create form's Company select and the list's Company filter.

**Manager options needed an additive extension, not a new query surface**:
`useManagerOptionsQuery` (Managers' own public surface) gained an optional
`status` filter — every existing caller (Commercials' filter, the list
filter here) keeps calling it unfiltered; Allocations' own create form is
the first caller to pass `{ status: "active" }`, since
`StoreAllocationRequest` rejects an inactive manager and offering one in
the picker would be a control guaranteed to fail (ADR-0009).

**Manual end-to-end validation is BLOCKED, not merely deferred.** An
allocation moves stock from a company to a manager, and that stock has no
source yet: the Supplier Bon flow (M5 Phase 5) — the only path that puts
real, non-zero stock onto a company — has not been built. Every automated
gate (typecheck/lint/format/build/full test suite, 888/888 across 45
files) is green, and the backend contract was verified fresh from source,
not assumed — but a real `validateAllocation()` call against the live
backend today would 409 on `ALLOCATION_STOCK_INSUFFICIENT` (or the
capacity/obligation gates first, depending on the manager's own grattage
state) regardless of how correct the frontend is. This is an external
dependency on Phase 5, not a quality gap in this phase's own work — manual
validation is owed as soon as Bons ships stock that can actually be
allocated.

**No other backend changes** beyond the one `GET /admin/companies`
endpoint above.

## M5 Phase 5 — Bons (complete at the implementation level)

The fifth and final Stock resource. Draft → add-lines → validate, plus the
only cancel lifecycle in Stock (BC-AB), reusing `ConfirmActionDialog`'s
existing `reason` slot rather than a new component. Genuinely new,
verified from source (ADR-0022), not assumed from Allocation's shape:

- **The only mandatory file upload in Stock** — `evidence`, reusing
  Money's own `FormData`/`FileUploadField` pattern (Cheques' own
  precedent), not the M3.6 wizard's.
- **`BON_CANCEL_STOCK_INSUFFICIENT` is a real, live 409** — cancelling a
  validated bon can fail if the stock it brought in was already drawn down
  elsewhere (e.g. a later Allocation). `validateBon()` itself has no
  capacity check at all — a bon is the source of stock, not a consumer.
- **Only 9 error codes, no `BON_STOCK_INSUFFICIENT`** — a genuine contract
  fact (see above), not an incomplete registration.
- **A new Suppliers reference endpoint** (`GET /admin/suppliers`),
  byte-identical in shape to Companies' own — see ADR-0023.

**No manual validation blocker** — unlike Allocations, Bons is the SOURCE
of stock, so it can be exercised end-to-end against the seeded `Default
Supplier`/`Miza` company immediately. Manual validation is still owed
(not yet performed), same as Transfers'/Allocations' own.

## M6 — Grattage (the seam) — COMPLETE, manual QA passed

Four phases, each its own discovery → approval → implementation → commit
cycle. The name "the seam" is the frozen roadmap's own — Grattage is the
resource every Stock movement type reactively defers to (a restock-gate
check) and that Money's Deposits domain settles against, without ever
becoming a full third leg of either domain's own architecture.

**Phase 1 — Grattage Invoices (`b1713af`).** The domain itself:
list/detail/cancel, `access-dashboard`-gated (reusing the existing
constant, not a new permission), `isGrattageInvoiceCancellable()` mirroring
the backend's own `(status IN (pending,overdue)) AND deposit_id IS NULL`
predicate. No admin Create or Settle — both are backend-initiated flows,
out of scope by decision. Status vocabulary: pending (warning) → overdue
(danger) → settled (success) / cancelled (muted). List filters are
page/status/date-range only — no agent/client filter (deliberate scope
narrowing, matching the frozen roadmap).

**Phase 2 — Grattage Outstanding restock-gate domain (`8514662`).** A data
layer with no UI: `fetchGrattageOutstanding(agentId)` (full mapped read),
but the domain's `index.ts` exports **only** the narrow
`useGrattageRestockGateQuery(agentId)` (`select`-projected to
`{blocked, reason}`) — the full `useGrattageOutstandingQuery` stays
domain-private, unexported, with no caller until M7's own per-agent
Outstanding view needs it (ADR-0026). Both hooks share one cache key
(`grattageOutstandingKeys.detail(agentId)`), so a page consuming both
never double-fetches. `invalidation-map.ts`'s existing `deposit.created`/
`deposit.validated`/`deposit.rejected`/`grattage-invoice.cancelled`
entries were extended to include the `grattage-outstanding`/
`grattage-invoices` key prefixes — no new domain event needed.

**Phase 3 — Stock → Grattage restock-gate integration (`0ce24e2`,
corrected by `59888a5`).** The ONE sanctioned Stock←Grattage
domain-to-domain import (ADR-0027): `AgentTransferDetailPage` calls
`useGrattageRestockGateQuery(agentTransfer.commercialId)` and disables
Validate with an inline warning when the recipient commercial has an
undischarged grattage obligation — this mirrors the backend's own
**unchanged, still-hard** `StockService::validateTransfer()` STEP 7c block
(`TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`, 409). A parallel gate
was also added to `AllocationDetailPage` for the Manager-level
`TEAM_OUTSTANDING_GRATTAGE` reason, mirroring the then-current backend
block (`ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION`) — **this half was
later removed** (see the correction below) once the backend contract it
mirrored stopped existing. Both gates were deliberately kept separate from
`useFreshConfirm` (ADR-0018) — a foreign-domain advisory read is not the
same kind of check as a record's own staleness. Not wired into Agent Stock
Returns or Bons (verified, negative-scope tests confirm zero requests) —
neither resource has a Grattage-relevant actor in its own flow.

**Backend contract change and correction, mid-milestone.** Backend commit
`9af5d00` (`feat(allocation): settlement-aware Company -> Manager grattage
capacity`) removed `StockService::validateAllocation()`'s team-wide hard
block entirely (`AllocationTeamHasOutstandingObligation` deleted as a
class; `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` can never be emitted
again) and replaced it with a numeric formula: available capacity now
sums the manager's own validated grattage deposits **plus** validated
grattage deposits from any team commercial, minus the manager's own
validated allocations — an undischarged commercial obligation now restores
**zero** capacity but is **never, by itself,** a refusal. The sole
remaining Allocation gate is `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` (409,
unchanged exception/context shape), exposed only reactively (inside that
exception's own `context.available`) — no backend read exposes a manager's
capacity proactively, before or after this commit. After a
re-verification-only pass (per explicit request) confirmed this from
source, `59888a5` performed the approved, targeted correction:
`AllocationDetailPage`'s and `ValidateAllocationDialog`'s restock-gate
call/banner/prop plumbing were removed entirely, the
`ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` entry was removed from the
error-code registry, and both files' docblocks were rewritten to describe
the current formula and explicitly forbid a client-side capacity
derivation (see ADR-0029, and ADR-0032 for the standing no-client-side-
derivation rule). Agent Transfer's own gate was untouched —
its backend contract did not change. Test count moved from 30 to 25 in
`allocation-detail-page.test.tsx` (five gate-specific tests removed,
replaced by one negative-scope test proving the gate is genuinely no
longer consumed there).

**Phase 4 — Deposit ↔ Grattage Invoice linking (`8d5bf60`).** Two
directions, both literal-path navigation (never a route-module import,
mirroring `invalidation-map.ts`'s own existing literal-key precedent):
- **Invoice → Deposit**: `GrattageInvoiceDetailPage`'s `depositId` row
  became a real link to `/money/deposits/${depositId}`, with a
  status-aware label (`Settling deposit #N` once `settled`,
  `Reconciliation deposit #N` before that — mirroring the backend's own
  `deposit_id`-set-at-creation / `status`-flips-at-validation timing).
- **Deposit → Invoices**: a new "Grattage invoices" section on
  `DepositDetailPage`, gated on `type === "grattage"` AND
  `access-dashboard`, backed by a **private, domain-local** read inside
  Deposits (`fetchLinkedGrattageInvoices`, `GET /admin/grattage-invoices
  ?deposit_id=...`) — **Option B** (ADR-0030): the user explicitly rejected
  extending Grattage's own public surface (Option A) and a hybrid (Option
  C) to avoid a second Money↔Grattage domain edge; this mirrors the
  pre-existing M4.3 `fetchGrattageOutstanding`/`useGrattageOutstandingQuery`
  precedent already living inside Deposits. Used the new backend
  `deposit_id` filter on `GET /admin/grattage-invoices` (backend commit
  `057c8b2`, combinable with `agent_id`/`client_id`, same envelope, same
  gate — confirmed live before implementation).

**Final M6 completion review** (before manual QA) re-audited the
implementation against the frozen roadmap's own M6 requirements across ten
areas and found one non-blocking issue: a stale, orphaned docblock on
`invalidation-map.ts`'s `deposit.validated` entry (Phase 2's edit had left
the original pre-M6 comment stacked above the new one). Fixed as a
comment-only cleanup (`f843008`, confirmed via diff to be 1 insertion / 2
deletions, no behavior change). The review also surfaced one scope
decision, made explicitly by the user rather than assumed: the per-agent
Outstanding-obligation UI view stays an M7 Agent 360 deliverable, not
retroactively credited to M6 just because its data layer already exists.

**Manual QA has passed**, including the corrected Allocation capacity
scenario (re-tested by the user after `59888a5` shipped).

**No new permission constants.** Grattage reuses the existing
`ACCESS_DASHBOARD` permission throughout — the backend's own
`GrattageSalePermissions` catalogue exists but is unenforced by any route
this milestone touches (disclosed, not a defect this frontend can fix).

**Known, disclosed, non-blocking gap carried forward:** `eslint.config.js`
has no actual domain-to-domain boundary rule — only a deep-import ban and a
`domains → app` ban exist. The roadmap's own claim that the Stock←Grattage
boundary is "verified by the boundary lint" is not literally true; the ONE
sanctioned import is enforced by review discipline and this document, not
tooling. Not fixed this milestone (out of scope, flagged as a follow-up —
see `next-session.md`).

## M7 — Agent 360 — COMPLETE, manual QA passed

The first of M7's three composed surfaces (Agent 360, Client 360, the
Overview widget grid — see "Next milestone" below). Five phases plus one
manual-QA-driven finalization pass, each its own discovery → approval →
implementation → commit cycle. Agent 360 is the frozen architecture's
own named workflow (§6): "Agent detail becomes a WorkspacePage: profile
(Network), cheque/deposit history (Money), current stock balance +
transfer/return history (Stock), outstanding obligation + restock gate
(Grattage) — one screen, reached from the Network module."

**Phase 1 — Workspace foundation (`c392a7e`).** `AgentWorkspacePage`, a
single flat route (`/network/agents/:id`) reached from both Managers' and
Commercials' own list rows — the first `WorkspacePage`-pattern page in the
product, and the pattern the frozen roadmap asked M7 to establish. Identity/
profile fields, document links, Block/Activate (reusing the existing
mutations unchanged), `view-agents` gated. `AgentController::show()`'s own
`$agent->toArray()` (no transform, no Resource class) is modelled as a
discriminated union tagged on `role`, per-role fields genuinely null for the
other role (verified from source, not assumed).

**Phase 1.5 — Full role-aware Agent Edit (`21c6e05`).** The complete
backend-supported editable field set, verified field by field against
`AgentController::update()` — not merely everything `show()` returns.
Existing document/photo previews render via `existingUrl` (a new,
additive, backward-compatible `FileUploadField` contract — every one of
the ~11 onboarding-wizard callers unaffected); selecting a replacement
switches the preview, "Remove" reverts to the existing file, never
synthesizes a `File` from a remote URL. `manager_id` (Commercial-only
reassignment) was **excluded at this phase** — the backend guard existed
(`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`) but no authoritative Commercial
stock read did yet, and building a reassignment control with nothing live
to gate it on would have been exactly the invented-capability ADR-0009
forbids. Moto editing stays out of scope (a distinct conditional
sub-entity, its own future item). This exclusion was **temporary, not a
scope decision** — see the completion item below, which superseded it the
moment its blocking dependency shipped.

**Phase 2 — Money and Stock workspace panels (`2ff0d5a`).** Composed via
mechanism 1 (page-level composition, FTA §4) — Money, Stock, Agent
Transfers and Agent Stock Returns' own public surfaces are imported
directly; none of the four domains has any idea Agent 360 exists. Money:
recent cheques/deposits/debt-payments activity. Stock: role-branched — a
Manager's own authoritative current-stock table (`ManagerStockItem`,
reused unchanged) plus recent Allocations; a Commercial's recent Transfers
and Returns (Current Stock came later — see the completion item). Every
panel is independently `PanelBoundary`-wrapped: one panel's query failure
or render crash cannot blank the other four, and each panel's own query
fires in parallel with the others, not serially — the frozen roadmap's own
M7 exit criteria, verified in the network panel and by dedicated
independent-isolation tests, not assumed.

**Phase 3 — Grattage Outstanding panel (`69f50aa`).** The per-agent
Outstanding-obligation view M6 explicitly deferred to M7 (ADR-0026),
fulfilled: `useGrattageOutstandingQuery` — previously domain-private — is
now exported from `domains/grattage/outstanding/index.ts`, its first real
caller. Role-branched, with a deliberate UX guardrail: a Commercial sees
their own full financial state (required/pending/overdue totals, up to 5
invoices) plus wording scoped **only** to "new stock transfers to this
Commercial are currently blocked" — never implying the Agent, the Manager,
Allocation, or Stock generally is blocked. A Manager sees only a coarse
clear/team-outstanding sentence — zero amount, zero count, zero inferred
per-commercial identity, and zero Allocation-blocking language (Allocation's
own gate was already removed by the M6 correction — ADR-0029 — and this
panel does not reintroduce it by implication).

**Completion item — Zero-stock Commercial → Manager reassignment guard
(`1aa1d66`).** The frozen architecture names this exact workflow (§6):
"Reassigning a commercial's manager is backend-blocked while they hold
stock. The Agent edit form shows the live Stock balance inline and
disables the manager field with an explanation." A completion review found
this was the one genuine gap against that frozen requirement — not a
missed nice-to-have, a named cross-domain workflow — and it shipped as the
milestone's closing item rather than being deferred again. Unblocked by a
backend addition, `GET /admin/agents/{agent}/stock-quantity`
(`access-dashboard`, Commercial-only): the Manager field on a Commercial's
Edit form is now live, seeded with the current manager, sourced from
`useManagerOptionsQuery` (Managers' own picker, reused verbatim), and
**disabled whenever the authoritative live stock read has not confirmed
`stock_quantity === 0`** — loading, error, and "permission absent" all
fail closed (disabled), never open. The backend's own atomic, locked
`update()` guard remains the sole authority regardless of what this
proactive read shows; a backend-race 422
(`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`) keeps the drawer open, surfaces
the message, and refreshes the stock read. No stock quantity is ever
derived from Transfers/Returns/movement history — the endpoint reuses
`StockService::listOwnerStock('agent', ...)` verbatim, the same definition
`update()`'s own guard checks.

**Manual QA finalization (`bc54e55`) — three real defects found in browser
testing, each root-caused from source before being fixed, none patched
around:**

- **`FormDrawer` long-form scrolling.** A form taller than the sheet's own
  viewport pushed the header and Save/Cancel footer out of reach entirely
  — the first modification to `FormDrawer` since its M2c extraction (see
  "Shared pattern layer" below). Root cause: a flexbox "min-height:auto"
  trap (an unconstrained flex-column child never shrinks below its own
  content's height). Fixed with `min-h-0 flex-1` on the form and its
  scrollable field region, making that region the sole scroll container.
  Short forms (Villes, Secteurs, …) are visually unaffected.
- **`FileUploadField` replacing an existing file inside the now-scrollable
  drawer.** Selecting a replacement photo visually blanked the whole
  panel. Two candidate mechanisms were investigated; only reproducing live
  in Chrome (jsdom cannot simulate this) found the real one: `overflow-hidden`
  — added defensively in the scrolling fix above — is still a genuine CSS
  scroll container per spec, and the browser's native "scroll the focused
  element into view" behavior (firing when the file input regains focus
  after the OS picker closes) was adjusting *that* container's own
  `scrollTop`, on top of the intended inner region's. Fixed by using
  `overflow-clip` instead, which clips identically but is explicitly not a
  scroll container. Confirmed live, before and after: `scrollTop` moved
  from `0` to `920` with `overflow-hidden`; stayed `0` with `overflow-clip`.
  Separately, `FileUploadField`'s status text/Remove button and its preview
  `<img>`/`<a>` now stay permanently mounted (`hidden` toggled, never
  conditionally rendered) rather than being torn down and rebuilt on every
  selection — a real, independently-verified defect (Radix `FocusScope`'s
  own `MutationObserver` can yank focus on any DOM removal inside a
  trapped dialog while focus is transiently on `document.body`, which the
  native file-picker round trip produces) kept as a genuine improvement
  even though it was not the cause of the scrolling defect itself.
- **Commercial Current Stock, product breakdown, and Available Grattage.**
  Backend commits `f9a6fe4` and `15aa704` widened the SAME
  `stock-quantity` endpoint (no new request) to also carry
  `available_grattage` (a decimal string, produced by the newly-extracted
  `StockService::commercialAvailableGrattage()` — the SAME formula
  `validateTransfer()`'s own capacity gate now calls, verified from
  source, not a second implementation) and `stock` (a per-product
  breakdown, identical row shape to `GET /admin/managers/{manager}/stock`,
  already filtered to `quantity > 0` server-side). The Commercial Stock
  panel now shows a "Total stock: N units" summary (read directly from
  `stock_quantity`, never summed from the visible rows) over a product
  table, and an "Available Grattage" line rendered **verbatim** as the
  backend's own decimal string — no currency suffix invented, matching
  this file's own established `montant` convention, never parsed to a
  number, never combined with `montant_avance_grattage`, Transfers,
  Returns, Deposits or Outstanding. `StockProductTable`, the actual
  `<table>` markup, is now shared between Manager's and Commercial's
  Current Stock — genuinely identical row contract and presentation — but
  the surrounding query/loading/error/empty-state logic stays separate per
  caller (different copy, different surrounding sections), not forced into
  one component. The Zero-stock reassignment guard's own condition is
  unchanged: `stock_quantity === 0` only, never derived from
  `available_grattage` or the product rows.

**No new invalidation entries were needed for any of the three widened
fields** — `stock_quantity`, `available_grattage` and `stock` are all
derived from the identical `listOwnerStock()` call the pre-existing
`agent-transfer.validated`/`agent-stock-return.validated`/
`grattage-invoice.cancelled` invalidation-map entries already bust.

**No new permission constants.** Every Agent 360 panel reuses an existing
permission (`view-agents`, `access-dashboard`, `view-allocations`,
`view-agent-transfers`, `view-agent-stock-return`, `update-agent`,
`block-agent`, `activate-agent`) — each panel independently gated, absent
entirely (not a disabled placeholder) when its own permission is missing,
and its query never fires without it (verified, not assumed, by dedicated
no-request tests throughout).

**Manual QA passed** — scrolling, file/photo replacement, existing file
previews, Commercial Current Stock, the product breakdown, Available
Grattage, Stock Return correctly refreshing the workspace, the zero-stock
reassignment guard, and reassignment succeeding once stock reaches zero
were all exercised against the real running backend.

## M7 — Client 360 — COMPLETE, manual QA passed

The second of M7's three composed surfaces. Client 360 is the frozen
architecture's own named workflow (§6): "Client detail composes profile/
assignment history (Network) with purchase history via grattage invoices
(Grattage)" — a genuinely narrower cross-domain surface than Agent 360's
(Network+Money+Stock+Grattage), and every part of it is now delivered.

**Phase 1 — Foundation (`9cc464a`).** `ClientWorkspacePage` at
`/network/clients/:id`, reached from the list's own new "View" action. A
minimal `ClientDetail` model (`id`, `phone`, `status`, `ville`, `secteur`,
`createdAt`, `commercial`) deliberately excludes `solde`/`debt`/
`dept_to_commercial`/location/OTP fields — no authoritative Client-
receivable semantics exist (verified from `SalesService`'s own backend
docblock). `ClientFormSheet`/`ClientStatusDialog` are reused verbatim from
the list (M3.4), not forked. Fixed a real, pre-existing defect found
during this phase: `ClientStatusDialog` previously offered "Activate" to a
`pending` client, but `Client::toggleStatus()` 400s that transition
outright — pending clients now correctly get no status action anywhere.
Edit widened to include `secteur` (city-scoped select).

**Phase 2 — Commercial relationship + assignment history (`506e992`).**
Backend commit `7066ffa` (append-only `client_assignment_histories`,
`GET /admin/clients/{id}/assignment-history`, `view-clients`) verified
fresh from source first. `ClientCommercialSection` reads
`ClientDetail.commercial` ONLY, never assignment history. Reassignment
uses ONLY `PATCH /admin/clients/{id}/assign` — never `POST` to the same
path, which also silently rewrites `ville`/`secteur` (ADR-0035).
Same-target reassignment was already a client-side no-op at this phase (no
request fired) — see the QA fix below for what manual QA still found
wrong with it.

**Phase 3 — Grattage purchase history (`22f2ba9`).** The frozen
requirement's final named capability. Widened
`domains/grattage/invoices/` with the smallest sanctioned public export,
`useClientGrattageInvoicesQuery`, nested under the existing
`["grattage-invoices"]` key prefix so the four pre-existing
invalidation-map events continue to cover it via TanStack's own prefix
matching — no new `invalidation-map.ts` entries. `ClientGrattagePanel` is
`access-dashboard`-gated, independent of the page's own `view-clients`.
Each row's Commercial comes from THAT invoice's own historical `agent`
relation, never `ClientDetail.commercial` — a client reassigned after an
older purchase still shows who actually made that sale.

**Manual QA fixes (both found during the real-browser pass against the
checklist in `next-session.md`, both fixed and re-verified before commit):**

- **Same-Commercial reassignment UX (`55cc33d`).** The Reassign button
  stayed enabled while the picker still showed the client's current
  Commercial — clicking it silently closed the drawer with no request and
  no feedback, which read as a possible bug rather than a deliberate
  no-op. Root-caused from source: no functional/audit-integrity issue
  existed (the backend's own `appendHistoryIfChanged` already makes a
  same-agent history row structurally impossible, and the frontend already
  skipped the request), so this was UX-only. Fixed with an additive,
  optional `submitDisabled` prop on the shared `FormDrawer` (every other
  caller unaffected, defaults `false`) — `ClientReassignDrawer` disables
  Reassign whenever the selection still equals the current Commercial, and
  re-enables it the instant a genuinely different one is picked. The
  existing `onSubmit` same-target short-circuit is kept as defense-in-depth
  for a programmatic/Enter-key submit that bypasses the disabled button.
- **Agent 360's Available Grattage presentation (`47ab778`).** A separate
  manual-QA finding on Agent 360's own Stock panel, closed in the same
  session: `available_grattage` (the numeric transfer capacity) rendered
  with no indication it could be non-actionable while
  `restock_gate.blocked === true` — backend-confirmed that `blocked` has
  priority over the numeric capacity, and Transfer validation itself
  already enforces that order correctly. `CommercialStockTotal` now reuses
  the existing `useGrattageRestockGateQuery` hook (no new query, shares its
  cache entry with `AgentOutstandingPanel`) and shows a small contextual
  note only on a confirmed `blocked === true`. The numeric capacity is
  never hidden, zeroed, or replaced; Transfer validation and backend
  semantics are unchanged.

**No backend changes in Phase 3 or either QA fix.** No new ADR — both QA
fixes reuse existing, already-decided infrastructure (`FormDrawer`'s
pattern-layer role, `useGrattageRestockGateQuery`'s existing public
surface) rather than introducing a new one.

**Manual QA passed** — Client 360 route/profile, the Active↔Blocked status
flow, pending clients' correctly-absent status action, Edit (phone,
Ville/Secteur dependency and reset behavior), current Commercial display,
Commercial reassignment (including the same-Commercial disabled UX and
Ville/Secteur staying untouched), Assignment History refresh and
historical-actor/timestamp display, Grattage purchase history (pending/
settled/cancelled invoice detail links, historical invoice Commercial
staying independent from the Client's current Commercial), panel
isolation, and permission behavior were all exercised against the real
running backend.

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
| M3.5 — Client bulk-assign | ✅ complete |
| **M3.6 — Agent onboarding wizard** | ✅ **complete** — manually validated, three post-validation fix rounds applied |
| M3.x — Admin + Manager + Commercial detail pages (ADR-0014) | ⬜ pending — **blocked by FE-2** |
| **M4.1 — Money infrastructure** | ✅ **complete** — manually reviewed and validated |
| **M4.2 — Cheques, Phase 1+2 (list, read-only)** | ✅ **complete** |
| **M4.2 — Cheques, Phase 3A (creation)** | ✅ **complete** |
| **M4.2 — Cheques, Phase 3B (pending queue, detail page)** | ✅ **complete** |
| **M4.2 — Cheques, Phase 3C (approve/reject/annuler, incl. allocation split)** | ✅ **complete** |
| **M4.2 — Cheques — full workflow** | ✅ **COMPLETE, manually validated end to end against the real running backend** |
| **M4.3 — Deposits (list, detail, validate/reject, creation)** | ✅ **complete** |
| **M4.4 — Debt Payments** | ✅ **complete** |
| **M4 — Money — full milestone** | ✅ **COMPLETE** (all three resources; manual validation of Cheques' own workflow done, Deposits'/Debt Payments' still owed) |
| **Freshness-rule retrofit (`useFreshConfirm`, M4 "Gate G4" closure)** | ✅ **complete** — onto Cheques' and Deposits' existing dialogs |
| **M5 discovery — Stock** | ✅ **complete** — 5-phase order approved, 3 backend items raised |
| **M5 Phase 1 — Agent Stock Returns** | ✅ **complete**, manually validated |
| **M5 Phase 2 — Agent Transfers** | ✅ **complete** — manual validation still owed |
| M5 Phase 3 — shared-component extraction (per-caller, ongoing) | ✅ `LineItemsEditor`/`useFreshConfirm` already extracted at their first callers — no dedicated phase needed beyond that |
| **M5 Phase 4 — Allocations** | ✅ **implementation complete** — Bons now shipped, prior stock-source blocker resolved; manual validation still owed |
| **M5 Phase 5 — Bons** | ✅ **implementation complete** — manual validation still owed, no blocker |
| **M5 — Stock, full milestone** | ✅ **COMPLETE at the implementation level** (all five phases); manual validation owed for Transfers, Allocations, Bons |
| **M6 — Grattage (the seam)** | ✅ **COMPLETE, manual QA passed** — Invoices, restock-gate domain, Stock integration, Deposit↔Invoice linking |
| **M7 — Agent 360** | ✅ **COMPLETE, manual QA passed** — workspace foundation, full Agent Edit, Money/Stock panels, Grattage Outstanding, zero-stock Manager reassignment guard |
| **M7 — Client 360** | ✅ **COMPLETE, manual QA passed** — foundation, Commercial relationship/assignment history, Grattage purchase history, plus two manual-QA fixes (same-Commercial reassignment disable, Agent 360 blocked-Grattage-capacity clarification) |
| M7 — Overview widget grid | ⬜ not started — discovery is the next task |

**Tests: 1237/1237 across 61 files** (was 407/23 before M3.6; 431/24 at
M3.6's initial implementation; 442/24 after M3.6's three post-validation fix
rounds; 447/25 after M4.1; 473/26 after M4.2 Phase 1+2; 489/27 after M4.2
Phase 3A; 520/29 after M4.2 Phase 3B; 548/29 after M4.2 Phase 3C; growing
across M4.3's four phases, M4.4, the freshness-rule retrofit, M5's own five
phases (825/42 after Agent Transfers, 888/45 after Allocations, 951/48
after Bons), 949/48 after the stock-aware product-selection refactor
removed the allocation/transfer-number field tests it made moot, M6's own
four phases plus the Allocation capacity correction (1022/52), M7 Agent
360's five phases plus the manual-QA finalization pass (1159/60), then M7
Client 360's three phases plus the two manual-QA fixes (same-Commercial
reassignment disable, Agent 360 blocked-Grattage-capacity clarification),
net **1237/61**). Run twice to rule out FE-1's known flake — two different,
unrelated, untouched files (`pending-cheques-page.test.tsx`,
`agent-transfers-list-page.test.tsx`) hit it under interleaved load in one
run, both passed clean standalone, confirming the flake rather than a
regression.
Lint ·
typecheck · format · build all clean, re-verified fresh this session.

## Shared pattern layer

Four `patterns/` components, **unmodified since extraction**:

- `ListPage`
- `ListLoadingState` · `ListErrorState` · `ListEmptyState`

**`ConfirmActionDialog` was MODIFIED at M4.2 Phase 3C** — the first change
to any `patterns/` component since extraction. Gained four additive
props, all optional, none of the prior 8 callers (Villes/Secteurs/Products
delete, Managers/Commercials/Clients status, Admins toggle/delete) changed
or retested differently:

- `variant` (`"destructive"` default, unchanged; `"default"` for an
  affirmative action — Cheques' Approve)
- `reason` (a labeled, validated required-text field — Cheques'
  Reject/Annuler)
- `confirmDisabled` (a generic caller-owned validity gate — Cheques'
  Approve allocation-split sum check)
- `children` (block-level custom content rendered outside
  `SheetDescription`'s `<p>` — Cheques' Approve amount/allocation inputs)

See `project-status.md`'s own M4.2 Phase 3C section above for why each was
added and in what order.

**`FormDrawer` was MODIFIED during M7 Agent 360's manual-QA finalization
pass** — the second change to any `patterns/` component since extraction,
and the first that is a real bug fix rather than an additive prop. A form
taller than the sheet's own viewport made the header and Save/Cancel
footer unreachable (a flexbox min-height trap); fixed with `min-h-0
flex-1` on the form and a dedicated scrollable field region, and
`overflow-clip` (not `overflow-hidden` — see the M7 section above for why
that distinction is load-bearing, root-caused live in Chrome, not
guessed) on the sheet content itself. **Layout-only — no prop, no API
surface, no caller's own code changed.** Every existing caller (Villes,
Secteurs, Products, Managers, Commercials, Clients, Admins, the client
bulk-assign sheet, Agent Edit) is visually unaffected for a form that
already fit; only a field list taller than the viewport (Agent Edit is
currently the only one) newly scrolls correctly instead of clipping.

**`shared/components/ui/textarea.tsx`, new at M4.2 Phase 3C** — the
missing shadcn primitive (mirrors `Input`'s own styling), needed for
`ConfirmActionDialog`'s new `reason` field. Not previously generated;
authored by hand to match the existing generated primitives' shape (no new
dependency — no Radix package backs a plain `<textarea>`).

**Three `business/` components, new at M4.1** — `shared/components/business/`
did not exist before this milestone:

- `StatusBadge` — six-tone system (Design System §17); `tone`+`label` props
  only, no status vocabulary of its own. Consumed by Managers/Commercials/
  Clients' list pages via each domain's own `*_STATUS_TONES` map, and now
  Cheques' (M4.2, all list/detail screens).
- `MoneyAmount` — wraps `formatMoney`, adds `tabular-nums` + the negative-
  value danger color. Consumed by Products' list page only — Managers'/
  Commercials'/Clients' pre-formatted money strings deliberately do not use
  it, and Cheques' `amount` (M4.2) does not either, for the same reason
  (see the M4.1 and M4.2 sections above).
- `FileUploadField` — promoted unchanged from `agent-onboarding/`. Consumed
  by the wizard's Documents/Moto steps; Cheque photo upload (Phase 3A) used
  it too. Money's other two named callers (Deposit proof, Debt Payment
  proof) remain unbuilt.

**Two more `business/` components, new at M4.2 — the first real callers of
`DataTable`/`FilterBar`, both flagged as "reaches evidence, not yet
extracted" since M3.4:**

- `DataTable` — headless paginated-table shell (structure only; no sort,
  pagination or loading/error/empty logic, which stay each caller's own
  `ListPage`/state). Extracted from the byte-identical markup already
  proven across Villes/Managers/Commercials/Clients; consumed by Cheques'
  list page. Those four resources were **not** retrofitted onto it this
  phase — a separate, larger migration, out of scope.
- `FilterBar`/`FilterField` — the proven `flex flex-wrap items-end gap-3` /
  `flex flex-col gap-1.5` wrapper shape only, **not** a config-driven filter
  system. Consumed by Cheques' list page; the same four resources were not
  retrofitted.

**Still deliberately not extracted**: `EntityChip` · Resource-definition
module · URL-filter hook.

**`TextField` stays domain-local to the wizard** — used ~20 times, but
entirely within one screen (same-screen repetition, not cross-resource
evidence). ADR-0006's Rule-of-Three is about resources, not repetition
within a single screen, so no extraction decision applies to it yet.

**The cross-domain picker-export tally moved to "3" during M3.6's
post-validation Follow-up 4** — the wizard's manager picker still *reuses*
`useManagerOptionsQuery` unchanged (no new instance from that), but the
Sector fix added `secteurs/index.ts` exporting `useSecteursQuery` to the
wizard: (1) Managers → Commercials (M3.3), (2) Commercials → Clients (M3.5),
(3) **Secteurs → Agent Onboarding (M3.6 Follow-up 4)**. This reaches the
count the tally has been tracking toward since M3.4 — flagged here as a
decision point for a **future** session, not acted on now (no extraction
happened this session; adding one would be scope well beyond a
manual-validation fix).

**A second, distinct cross-domain pattern appeared in Follow-up 3**:
`managers/index.ts` now exports `ManagerAreaMultiSelect` itself (a
component, not a `useXOptionsQuery` hook) for the wizard to reuse unchanged.
This is a different shape of coupling than the picker-export tally above and
is **not** added to that row — recorded here as its own, first instance, not
conflated with it.

**A third, distinct cross-domain pattern appeared at M4.2**:
`ChequeAgentFilter` merges two *existing* picker exports
(`useManagerOptionsQuery` + `useCommercialOptionsQuery`) into one `<select>`
inside Cheques, rather than Cheques itself exporting anything new for a
further downstream consumer. Not the same shape as the export tally below
(which counts a resource handing its own picker to a sibling) — recorded
here as its own instance, same treatment as `ManagerAreaMultiSelect` above.

**Rule-of-Three evidence tally, recorded factually.** `StatusBadge`,
`MoneyAmount` and `FileUploadField` moved from "evidence recorded, not
acted on" to **extracted** at M4.1 — the first rows in this tally's history
to actually cross into `shared/`. Every other row is unchanged from M3.6:

| Component | Evidence | At ADR-0006's stated threshold? |
| --- | --- | --- |
| `DataTable` | 4 paginated resources (Villes, Managers, Commercials, Clients) | **EXTRACTED at M4.2**, consumed by Cheques' list page only — the 4 resources whose evidence justified it were not retrofitted this phase |
| `FilterBar` | 4 resources with server-supported search/multi-filter | **EXTRACTED at M4.2**, consumed by Cheques' list page only — same non-retrofit decision as `DataTable` |
| `StatusBadge` | 3 resources with a real status enum (Managers/Commercials share one vocabulary, Clients a second) | **EXTRACTED at M4.1** — built to Design System §17's full spec, not the 3 call sites' own minimal shape, anticipating Money's richer vocabulary |
| `MoneyAmount` | Products' `value` is a genuinely numeric column; Managers'/Commercials'/Clients' money fields are deliberately excluded (pre-formatted strings, not raw numbers) | **EXTRACTED at M4.1**, consumed by Products only today — Money's Cheque/Deposit/Debt Payment `amount` fields (M4.2+) are the real 2nd/3rd/4th callers |
| `EntityChip` | 0 — filter `<select>`s are not the roadmap's sanctioned infinite-query autocomplete | Not reached |
| Resource-definition module | 0 — Network is not reference-shaped | Not reached |
| URL-filter hook | ADR-0006's own wording ("a resource with 3+ filters") reads as a **per-resource**, not cross-resource, threshold. Managers already had 5 filters at M3.2; Clients has 4. **Still not resolved** | Ambiguous, unresolved |
| **Cross-domain picker export** (`useVilleOptionsQuery` → `useManagerOptionsQuery` → `useCommercialOptionsQuery` → `useSecteursQuery`) | **3** instances: Managers → Commercials (M3.3), Commercials → Clients (M3.5), Secteurs → Agent Onboarding (M3.6). **Unaffected by M4.1** — no new instance added | Reaches "3" — still the next actual decision point, still not resolved |
| **Row selection / bulk action bar** (M3.5) | **1** — unaffected by M4.1 | Not reached, not close |
| **File upload control** (`FileUploadField`) | **EXTRACTED at M4.1** — justified by Money's three NAMED upcoming callers (Cheque photo, Deposit proof, Debt Payment proof, all confirmed from source during M4 discovery), not by current evidence alone; M3.6's own ~11 internal call sites were explicitly insufficient on their own | Promoted ahead of the callers actually landing — a deliberate exception, not a precedent for extracting on named-but-unbuilt callers generally |
| **`ApprovalQueuePage`**, new row at M4.2 Phase 3B/3C | **1** — the frozen architecture doc names this pattern for Cheques' Pending queue, but only one real consumer exists and its endpoint accepts no filters, so nothing "actionable" a shell would add over `ListPage` yet | Not reached — explicitly declined this phase (see Phase 3B's own write-up above), not silently skipped |
| **`DetailPage`**, new row at M4.2 Phase 3B | **2** as of M4.3 (Cheques, Deposits) — Deposits' own detail page (M4.3) is domain-local too, same Rule-of-Three reasoning re-applied, not re-derived | Not reached — a genuine third consumer (a Network detail page, or Stock's own) would be the actual decision point |
| **`useFreshConfirm`** (M4 "Gate G4" closure) | **EXTRACTED at 2 domains** (Cheques, Deposits), reused unchanged by 2 more (Agent Stock Returns, Agent Transfers) — **5 real call sites** as of M5 Phase 2 | Extracted ahead of a third caller by decision, not evidence — see ADR-0018: a frozen-document mandate, not a repetition-discovered shape |
| **`LineItemsEditor`** (M5 Phase 1) | **EXTRACTED at its first caller** (Agent Stock Returns), reused unchanged by Agent Transfers (M5 Phase 2) — **2 real callers**; Allocations/Bons (both still pending) are expected to be the 3rd/4th | Extracted ahead of a third caller by decision, not evidence — see ADR-0019: the line contract was verified identical across all four Stock movement types' own FormRequests before extraction |
| **Manager→Commercial cascading picker** (Agent Stock Returns, Agent Transfers) | **2**, each its own domain-local copy, deliberately NOT extracted | **Will not reach 3** — Allocation's own binding rule uses a different counterpart pair entirely (`company_id` + `agent_id(role=manager)`), confirmed by re-checking the roadmap's remaining Stock resources, not assumed. See ADR-0021 |

**The cross-domain picker-export tally and the URL-filter-hook question
remain the two open Rule-of-Three decision points from M3/M4, still
unresolved.** No M4.3/M4.4/M5 phase added a fourth instance to the export
tally — Deposits'/Debt Payments' own agent pickers reuse existing exports
the same way Cheques' merged filter already did, and Stock's own
Manager→Commercial picker is domain-local by decision (ADR-0021), not an
export. `ApprovalQueuePage`/`DetailPage` moved from "1" to "2" at M4.3
(Deposits' own detail page is domain-local, same reasoning as Cheques') —
still short of three. `useFreshConfirm` and `LineItemsEditor` are two
NEW rows, both **already extracted ahead of a third caller**, by an
explicit, recorded decision (ADR-0018/ADR-0019) rather than Rule-of-Three
evidence — flagged here so a future review does not mistake either for a
precedent that evidence-gated extraction has been abandoned generally.

## Current blockers

| ID | Blocker | Blocks |
| --- | --- | --- |
| **FE-1** | Test-suite flake, raised at M3.2, **not touched this session; no flake observed in this session's runs** | Recommended before the suite grows further |
| **FE-2** | `withPermissionGuards` is shallow — a nested route's own `handle.permission` is silently ignored | The **deferred detail-page milestone** (ADR-0014). Still non-blocking — Cheques' detail page (M4.2 Phase 3B), this product's first real test of whether a nested route was needed, shipped as a FLAT sibling route instead, same as every prior domain. FE-2 remains an open fix, just still off the critical path |
| **BC-G** | Secteurs/Products/Admins index endpoints unpaginated | `DataTable`/`FilterBar` extraction |
| **BC-U** | 🟡 The agent **update** endpoint cannot clear or accept null for `num_d_abonnement` or `ville`, though both columns allow null | Nobody can un-set either field via the UI, ever, until the backend validator changes. Unaffected by M3.3: Commercials' update payload never sends `ville` (that field belongs to Managers only), and `manager_id`/`ville_actuelle`/`secteur` are all correctly `nullable` in the validator |
| **Operational** | Session permissions are cached at login (ADR-0003) and never refreshed. **Whenever a permission is newly seeded or corrected on the backend, an operator already logged in will not see the effect until they log out and back in** — this is how Block/Activate visibility was investigated and cleared this session (see below); not a code defect | Any future backend permission change while operators hold open sessions |
| **BC-AA** (PARTIALLY resolved post-Bons) | 🟡 Two PER-OWNER stock reads now exist — `GET /admin/companies/{company}/stock`, `GET /admin/managers/{manager}/stock` (both pre-filtered to `available_quantity > 0`) — feeding Allocations'/Transfers' own "add line" pickers (ADR-0025). NO general cross-owner Stock ledger view exists; Return's/Bons' own pickers are unchanged (unfiltered catalogue) | Capacity/stock-insufficient refusals elsewhere remain REACTIVE only. A Stock ledger view (M7 Overview, or earlier if requested) still needs a real aggregate endpoint, not just these two owner-scoped reads |
| **BC-AB** (new, M5 discovery) | 🟡 Only Bons has a `/cancel` route — Allocations, Agent Transfers and Agent Stock Returns have no cancellation lifecycle at all | No cancel UI exists or was attempted for either Stock resource shipped so far; confirmed absent from `routes/api.php`, not assumed |
| **B-1** (RESOLVED — both halves, M5 Phases 4/5) | ✅ Read-only `GET /admin/companies` and `GET /admin/suppliers` both now exist (ADR-0023, mirror `SecteurController::index()`, no CRUD — by design, both are seeded reference data) | No longer blocks anything. A full CRUD directory screen for either was never the ask and remains out of scope (ADR-0023) — do not build one as a side effect of unrelated work |

### BC-T — resolved (M3.2, unchanged this session)

`block-agent` is now seeded; block and activate work end to end for both
Managers and Commercials (same permission, same endpoints).

### FE-1 — unchanged, not touched since M4.2 Phase 3B/3C

Five older test files' `findByRole("alert")` calls still run against the 1000 ms
default timeout while taking 951–1240 ms. Not touched by M4.3/M4.4/M5 — no
new evidence gathered, no fix applied. `pnpm test:ci` was run fresh at the
end of M5 Phase 2 (825/825, one transient timing flake observed on a full
parallel run, confirmed as a flake — not a regression — by both an
isolated re-run and a second full clean run). Still recommended before the
suite grows further; the suite is now at 825 tests across 42 files, 277
more than when this was last raised at M4.2 Phase 3C (548/29).

**Governance follow-ups — not blockers** (unchanged):

| ID | Item | Gates |
| --- | --- | --- |
| G2-A/E/F | Gate G2 wording amendments not yet adopted | Formal G2 closure |
| G2-R7 | Fourth-resource estimate needs team agreement | Formal G2 closure |

## M3 detail pages — deferred by ADR-0014

Unchanged. M3.4, M3.5 and M3.6 all ship with no nested route — M3.5 extends
the existing Clients list route in place, and M3.6's wizard is a new but
flat, top-level route (`AGENT_ONBOARDING_PATH`, no `children`), same shape
as every other M3 route. FE-2 remains non-blocking for all of them. All four
list-management resources are still built with no detail page among them,
and the wizard adds no detail-page footprint either — it is create-only by
decision (see its own section above).

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
| BC-V | **limitation** | `agents.secteur` has no foreign key to `secteurs` (confirmed: `Secteur` model has no relation back to `Agent`), is filtered by exact match, and the dev database has **zero** seeded secteurs. No options source exists to build a select from | 🟡 open — Commercials' list filter still has **no secteur filter or column** (ADR-0009 unchanged). **M3.6's wizard field is different**: it sources sector *options* from the real `Secteurs` reference table (scoped by city), but still submits a plain NAME with no FK, so the underlying limitation is unaffected — do not invent a distinct-values endpoint |

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

**From the M3.6 contract verification, against `AgentController::store`,
independently re-confirmed rather than assumed from `update`
(implementation complete, this table entry stands regardless of manual
validation outcome — it is a source-code fact, not a UI behavior):**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive** | `store()` correctly catches `ValidationException` before its generic handler, and its one manual business-rule check (the essence/moto rule) returns a properly `errors`-keyed 422 — BC-N does **not** apply to it | ✅ no action needed, recorded so a future session does not assume BC-N universally |
| BC-Y | **limitation, new** | `createMoto()` runs — and uploads its files — *before* `DB::transaction` wraps the agent insert in `store()`. A failed agent insert after a successful moto creation would leave an orphaned `Moto` row and orphaned files | 🟡 open — narrow (agent insert failing after successful moto creation + upload is rare), not something the frontend can route around. Worth a backend consultation item, not a blocker |

**From the M4.2 contract verification, against `ChequeController`, independently
re-confirmed rather than assumed from the M4 discovery report's own prose
(Phase 2's `index()`/`show()` findings plus Phase 3A's `store()` findings):**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-Z | **defect** | `show()` eager-loads `processedBy()` (`belongsTo(Agent::class, 'processed_by')`) instead of `index()`'s correctly-typed `processedByUser()` (`belongsTo(User::class, 'processed_by')`), despite `processed_by` always storing a **User** id. Eloquent's array serialization then overwrites the raw `processed_by` FK with this mismatched relation's (likely null or wrong) result | 🟡 **still open** — re-confirmed unaffected at Phase 3B: the Cheque Detail page deliberately does not display "processed by" at all rather than show the known-wrong value. Raise with the backend before attempting this field again |
| BC-P | **defect** | New instance of the class, narrower than Managers'/Commercials' own: `index()` uses `whereDate()` (correctly day-inclusive) when only ONE of `date_from`/`date_to` is given, but `whereBetween()` against the raw `created_at` timestamp (excluding most of `date_to`'s own day) when BOTH are given together | 🟡 open — "Submitted before" stays the honest label: exact when both filters are set together, harmlessly conservative when `date_to` is used alone |
| — | **verified, positive** | `cheques.amount`/`cheque_allocations.amount` are `decimal:2`-cast columns, confirmed to serialize as formatted STRINGS on the wire (never a JSON number), consistent with Eloquent's `asDecimal()` cast implementation — not a defect, but corrects an assumption stated in M4.1's own write-up | ✅ no action needed; `MoneyAmount` remains correctly unused for `Cheque.amount`, same discipline as `Manager.avanceTotal`/`Client.solde` |
| — | **verified, positive** | `store()`'s validator is exactly `agent_id`/`amount`/`num_cheque`/`photo_cheque` — confirmed against the live validator, the migration and the model's `$fillable` before any code was written, not assumed from the task's own first-draft field list (which named a Bank and an Issue Date field neither the migration, `$fillable`, nor the validator has) | ✅ no action needed; the Create Cheque form was scoped to these four fields, per ADR-0009 |
| — | **cleanup, new** | `store()`'s response nests `photo_url` as a SIBLING of the raw cheque object (`{cheque: {...}, photo_url: "..."}`), unlike `index()`/`show()`, which spread it INTO the same flat object (`[...$cheque->toArray(), 'photo_url' => ...]`). Two different envelope shapes for logically the same field, across three actions of one controller | 🟢 non-blocking — absorbed once, at the API mapper boundary (`cheques-api.ts`'s `createCheque()` merges the two before mapping), per ADR-0006/D-6's anti-corruption-layer discipline. Worth a backend consultation item (one consistent shape), not a blocker |

**From the M4.2 Phase 3B/3C contract verification, against
`ChequeController::pending/show/approve/reject/annuler`, independently
re-confirmed rather than carried forward from the discovery pass or Phase
3A's own notes unchecked:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive** | `pending()` runs NO `$request->validate()` at all — confirmed from source, not assumed from resemblance to `index()`'s own filtered validator. Only `page`/`per_page` are ever meaningful | ✅ no action needed; `PendingChequesPage` renders no `FilterBar` — exposing controls the endpoint ignores would misrepresent the system |
| — | **cleanup, new** | `approve()`'s success response nests the cheque under `data.cheque` (plus a sibling `agent_new_montant_avance`), mirroring `store()`'s own shape; `reject()`/`annuler()`'s `data` IS the cheque directly, mirroring `show()`'s shape minus its manually-added `photo_url`/`status_label`. A THIRD distinct envelope shape, across the same controller's five actions | 🟢 non-blocking — all three mutations return `void` and rely on invalidation-triggered refetch rather than parsing any of the three shapes, avoiding the inconsistency entirely rather than adding a fourth ad-hoc merge |
| — | **verified, positive, load-bearing** | `approve()`'s `allocations.*.amount` validator is `numeric\|min:0.01\|decimal:0,2` — a **zero-value allocation entry is REJECTED (422), not merely redundant to send**. Found on a deliberate re-verification pass, after an initial "simple confirm" implementation had already shipped without this fact mattering | ✅ no action needed; `ApproveChequeDialog` omits whichever side (rapped/grattage) is zero rather than sending `amount: 0` |
| — | **verified, positive** | `reject()`'s and `annuler()`'s `decision_reason` validation (`required\|string\|max:1000`) runs through Laravel's normal automatic exception handler (not a manual try/catch the way `approve()`'s own allocation validation is) — so a validation failure DOES field-map correctly to `errors.decision_reason`, unlike the swallowed-`ValidationException` pattern (BC-N) several other controllers exhibit | ✅ no action needed; `RejectChequeDialog`/`AnnulerChequeDialog` map this to the `reason` field's own inline error, not a generic banner |
| — | **verified, positive** | `annuler()`'s negative-balance guard returns `{success:false, message, errors: {<balance_column>: [...]}}` — an `errors` key IS present (so it normalizes to `kind:"validation"`), but keyed by a BALANCE COLUMN name, never `decision_reason` | ✅ no action needed; `AnnulerChequeDialog` detects this case structurally (a validation error not on `decision_reason`) and shows its own domain-owned message, never the raw backend string (`AppError.message` is documented as non-user-facing copy) |

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

### Deposits' `DepoResource` — RESOLVED, and shipped

The M4 discovery pass's original finding ("`DepoResource` omits `type` and
`status` from the wire entirely") was resolved before M4.3 even started
(`039685c feat(deposits): expose status and type on DepoResource`) — see
the earlier note in this file's own history. **The resource changed a
SECOND time, found during M4.3's own re-verification** (commit `8786326`),
unifying `index()`/`show()`/`store()` onto one shape and adding
`reject_reason`/`validated_by`/`validated_at`/`bank_name`/`proof_type` —
confirming the standing discipline (ADR-0022): a fact re-verified once is
not guaranteed to still hold the next time it matters, and M4.3 shipped
against the version re-read at ITS OWN start, not the M4 discovery pass's
older snapshot.

**From the M4.3/M4.4/M5 contract verification, independently re-confirmed,
not inherited from Cheques by resemblance:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive** | `Deposit.amount` is cast `(float)`, a genuine number — the first Money `amount` field `MoneyAmount` was actually built for; `Cheque`'s and `DebtPayment`'s stay `decimal:2`-cast strings, unaffected | ✅ no action needed |
| — | **verified, positive** | Deposits' `date`/`validatedAt` are `Y-m-d H:i`, not ISO — normalized once at the mapper boundary, the same "absorb it at the anti-corruption layer" discipline BC-Z's own write-up already established | ✅ no action needed |
| — | **verified, positive** | `validated_by`/`validated_at` populate for a REJECTED deposit too, not exclusively a validated one — `DepositService::reject()` sets them as well; the column names are misleading, not the frontend's modelling | ✅ no action needed; documented in `model/deposit.ts` so a future session does not "fix" this into an exclusivity check |
| — | **verified, positive** | Debt Payments' `debt_cash` permission is IDENTICAL across list and create (`routes/api.php:167-170`) — unlike Cheques'/Deposits' own split vocabularies | ✅ no action needed; both routes gate on the same permission string, mirroring the backend exactly |
| — | **verified, positive** | Debt Payments' `show()`/`destroy()` are commented-out dead routes | ✅ no action needed; no detail page, no delete UI attempted |
| BC-AC (new) | **limitation** | Debt Payments' `total_paid` summary scalar's wire type (JSON number vs. numeric string) was not captured from a live response — the mapper coerces with `String(...)` defensively either way | 🟢 non-blocking; revisit if a live capture ever contradicts the defensive coercion |
| — | **verified, positive** | Agent Stock Return's 13 and Agent Transfer's 15 error codes were each read directly from their own `*ExceptionRenderer`, not derived from each other — confirmed genuinely divergent in specific, named ways (see the M5 Phase 2 section above) | ✅ no action needed; ADR-0022 records this as a standing discipline, not a one-off check |
| BC-AA | **partially resolved** | Two per-owner stock reads now exist (company/manager); no cross-owner ledger view | 🟡 partially open — see the Backend dependencies table above |
| BC-AB | **verified, unchanged** | Only Bons has a `/cancel` route — now built on the frontend, for Bons only | ✅ no action needed; Returns/Transfers/Allocations correctly have no cancel UI |

**From the M6 contract verification, against `GrattageInvoiceController`,
`AgentController::computeGrattageRestockGate`, `StockService::validateAllocation`/
`validateTransfer`, and `DepositService`, independently re-confirmed rather
than assumed from Stock's/Money's own patterns:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive** | `GET /admin/grattage-invoices` gained a combinable `deposit_id` filter (`nullable\|exists:deposits,id`, backend commit `057c8b2`), same flat-paginator envelope, same `access-dashboard` gate | ✅ no action needed; powers Deposits' own linked-invoices read (Option B, ADR-0030) |
| BC-AD (new, resolved during M6) | **defect → resolved** | The Allocation team-wide hard block (`ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION`) was REMOVED by backend commit `9af5d00`, mid-milestone, requiring a targeted frontend correction (`59888a5`) | ✅ resolved; see the "M6 — Grattage" section above and ADR-0029. Recorded here so a future session understands why this code briefly existed in the registry and no longer does |
| — | **verified, positive** | `computeGrattageRestockGate()`'s manager-level `TEAM_OUTSTANDING_GRATTAGE` reason is explicitly documented (post `9af5d00`) as NOT AUTHORITATIVE for Allocation — informational only. `OUTSTANDING_GRATTAGE` (commercial-level) remains fully authoritative for Agent Transfer's own hard gate, unaffected | ✅ no action needed; Agent Transfer keeps consuming the gate, Allocation no longer does |
| — | **verified, positive** | No backend read exposes a manager's numeric Allocation capacity proactively, before or after `9af5d00` — `available` is only ever known reactively, inside `AllocationExceedsDepositCapacity`'s own exception `context` | ✅ no action needed; confirms BC-AA stays only partially resolved (no capacity read exists) — do not build a proactive capacity hint without a fresh backend read to back it |

**From the M7 Agent 360 contract verification, against `AgentController`
and `StockService`, independently re-confirmed rather than assumed from
Stock's own patterns — the milestone that finally closed the "no
authoritative Commercial current-stock endpoint" and "no authoritative
available-capacity read" gaps this file previously carried as open:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| — | **verified, positive, gap closed** | `GET /admin/agents/{agent}/stock-quantity` (backend commit `5302f99`), Commercial-only, `access-dashboard`-gated. Reuses `StockService::listOwnerStock('agent', ...)` verbatim, summed — the same definition `update()`'s own reassignment guard checks | ✅ resolved; powers the zero-stock Manager reassignment guard (Agent Edit) and, once widened below, the Commercial Current Stock panel. Superseded finding: earlier M7-Phase-2 discovery had recorded no such endpoint existed |
| — | **verified, positive, gap closed** | Same endpoint widened (backend commit `f9a6fe4`) to also carry `available_grattage`, a bcmath decimal string produced by the newly extracted `StockService::commercialAvailableGrattage()` — the SAME formula `validateTransfer()`'s own STEP 7b capacity gate now calls on the locked commercial row, verified from source | ✅ resolved; the real formula (`avance − max(0, validated transfers − validated returns)`, floored at 0, deposits excluded per Phase-5-Cap-Inv-1) is now read-exposed for the first time. Informational only — `validateTransfer()`'s own locked gate remains sole authority for an actual Transfer |
| — | **verified, positive, gap closed** | Same endpoint widened again (backend commit `15aa704`) to also carry `stock`, a per-product breakdown — identical row shape to `GET /admin/managers/{manager}/stock` (`product_id`/`name`/`operator`/`value`/`available_quantity`), already filtered to `quantity > 0`. `stock_quantity` and `stock` are both derived from ONE `listOwnerStock()` call, not two | ✅ resolved; powers the Commercial Stock panel's product table, sharing `StockProductTable` with Manager's own equivalent table |
| — | **verified, positive** | `manager_id` reassignment validation (`update()`) requires the target to be an active `Agent` with `role=manager` (`Rule::exists('agents','id')->where('status','active')->where('role','manager')`) — the same "eligible manager" convention Allocation/Agent Transfer/Agent Stock Return FormRequests already use | ✅ no action needed; the Manager `<select>` sources from `useManagerOptionsQuery({status:"active"})`, so an ineligible target can never be selected in the first place |
| — | **verified, positive** | The reassignment guard itself (`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN`, 422) is atomic — `update()` now locks the commercial row, re-checks stock, and writes the reassignment inside one transaction, closing a prior TOCTOU gap between the proactive read and the write | ✅ no action needed; the frontend's own stock-quantity read is explicitly a UX hint, never the authorization check — a backend race still surfaces correctly as a 422 that keeps the Edit drawer open and refreshes the read |
| — | **verified, positive, gap closed** | `update()` now catches `ValidationException` before its generic handler (same backend commit as the guard) — a genuine field-level 422 (e.g. an ineligible `manager_id`) now maps onto its own field, no longer swallowed into a generic 500 | ✅ resolved; this was a disclosed BC-N-class defect specific to `update()`, now fixed. Every other BC-N instance elsewhere in the product (Managers/Commercials/Clients list validation, etc.) is unaffected and stays open |

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
    ├── clients/            M3.4 (paginated · search · 3 filters (status,
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
    ├── agent-onboarding/   M3.6 — COMPLETE, manually validated
                                   (not a resource domain — a WORKFLOW domain,
                                   the first of its kind; creates a Manager OR
                                   a Commercial through one shared backend
                                   endpoint, POST /admin/agents; no list of
                                   its own, no detail page, reached only via
                                   Managers'/Commercials' own "Create..."
                                   buttons; page-based 5-step wizard: Identity
                                   -> Documents -> Financial -> Moto -> Review
                                   -> Success, one RHF instance throughout;
                                   first multipart/FormData request in the
                                   product; local-only FileUploadField and
                                   TextField, not shared/; reuses Managers'
                                   useManagerOptionsQuery for the manager
                                   picker and ManagerAreaMultiSelect for area
                                   of responsibility, both unchanged; city
                                   fields are Villes-backed selects; sector is
                                   a Villes-scoped select over Secteurs'
                                   useSecteursQuery, clearing/reloading on
                                   city change; phone subscription number
                                   validated against the same Moroccan regex
                                   ClientFormSheet uses; fuel amount lives on
                                   the Moto step, gas-only; no button is ever
                                   type="submit" — Review's confirm action is
                                   the sole, explicit submission path;
                                   dedicated success screen for one-time
                                   backend-generated credentials, ADR-0017)
    └── agents/             M7 Agent 360 — COMPLETE, manual QA passed
                                   (a second WORKFLOW-adjacent domain — the
                                   first cross-domain COMPOSITION surface,
                                   WorkspacePage pattern; a flat
                                   /network/agents/:id route reached from
                                   both Managers'/Commercials' own list rows;
                                   models the discriminated-union raw
                                   `$agent->toArray()` shape `show()` returns,
                                   tagged on `role`; identity/profile,
                                   Block/Activate, full role-aware Edit
                                   (existingUrl file-preview contract,
                                   Manager reassignment gated on a live
                                   Commercial stock-quantity read); composes
                                   Money/Stock/Agent Transfers/Agent Stock
                                   Returns' own public surfaces at the page
                                   level (mechanism 1, FTA §4) — none of the
                                   four domains knows Agent 360 exists;
                                   exports and consumes Grattage's own
                                   previously-domain-private
                                   useGrattageOutstandingQuery, its first
                                   real caller (ADR-0026); every panel
                                   independently PanelBoundary-wrapped and
                                   permission-gated, firing in parallel, one
                                   panel's failure never blanking another;
                                   Commercial Current Stock/product
                                   breakdown/Available Grattage all reuse the
                                   SAME stock-quantity read the reassignment
                                   guard already used, widened, not a new
                                   query; StockProductTable shared with
                                   Manager's own stock table)

src/domains/money/
└── cheques/               M4.2 — COMPLETE, all phases (1+2+3A+3B+3C),
                                   manually validated end to end
                                   (the first Money resource, the first
                                   resource outside Network; paginated list ·
                                   search · 4 filters (status, agent, date
                                   range) · a 4-value status enum · amount
                                   rendered verbatim as a decimal-cast
                                   STRING, never through MoneyAmount; agent
                                   filter/field merges Managers'/Commercials'
                                   existing pickers into one <select>, not a
                                   new export (two separate components: an
                                   optional list filter, a required create
                                   field); first real caller of the
                                   extracted DataTable/FilterBar; a Create
                                   Cheque page against a corrected, verified
                                   4-field backend contract (agent_id/amount/
                                   num_cheque/photo_cheque only — no Bank,
                                   no Issue Date); a Pending Cheques queue
                                   (no filters — the endpoint accepts none);
                                   the first detail page in this product
                                   (ChequeDetailPage, domain-local, not a
                                   new shared DetailPage — one consumer);
                                   Approve (with a rapped/grattage
                                   allocation split, cents-safe sum
                                   validation), Reject and Annuler, each its
                                   own ConfirmActionDialog-based dialog;
                                   first real caller of invalidateForEvent
                                   (cheque.created/approved/rejected/annuled,
                                   all four now registered); NO edit, NO
                                   delete, NO bulk actions, NO attachments,
                                   NO comments — none of these were ever in
                                   scope)
├── deposits/               M4.3 — COMPLETE, all four phases
                                   (list, detail page, validate/reject,
                                   creation); amount is a genuine cast
                                   number (first real MoneyAmount caller
                                   in Money); date/validatedAt normalized
                                   from Y-m-d H:i to ISO at the mapper
                                   boundary; validatedByName/validatedAt
                                   populate for rejected too, not only
                                   validated; type (rapped/grattage) is
                                   plain text, never StatusBadge; NO sort,
                                   NO date-range filter, NO perPage control
                                   — index() hardcodes paginate(20); NO
                                   shared DetailPage extracted (2nd
                                   consumer, still short of 3); Validate/
                                   Reject dialogs are the SECOND
                                   useFreshConfirm callers)
└── debt-payments/          M4.4 — COMPLETE (the third and simplest Money
                                   resource: list + submit only; admin_id
                                   -> User, not Agent — self-service,
                                   scoped to the logged-in admin, no
                                   admin_id filter exists; NO status, NO
                                   type column, NO lifecycle, NO
                                   StatusBadge; show()/destroy() are dead
                                   routes — NO detail page, NO delete;
                                   list response carries current_debt/
                                   total_paid summary scalars alongside
                                   the page, the first Money list to do so;
                                   amount stays a decimal-cast STRING,
                                   Cheques' discipline not Deposits')

src/domains/stock/
├── agent-stock-returns/    M5 Phase 1 — COMPLETE, manually validated
                                   (the first Stock resource, and the
                                   first domain whose failures carry a
                                   documented `code` from day one — 13
                                   RETURN_* codes registered; draft -> add
                                   lines -> irreversible validate, NO
                                   cancel — confirmed absent from
                                   routes/api.php; Manager->Commercial
                                   cascading picker guarantees the binding
                                   by construction, domain-local, ADR-0021;
                                   montant is metadata-only, recomputed on
                                   every line write, gates nothing; first
                                   real caller of the extracted
                                   LineItemsEditor, ADR-0019; FormRequest-
                                   gated permissions, no route middleware
                                   — a genuine departure from every prior
                                   domain)
├── agent-transfers/        M5 Phase 2 — COMPLETE (manual validation still
                                   owed); structurally mirrors Agent Stock
                                   Returns (same LineItemsEditor/
                                   useFreshConfirm reuse, same lifecycle
                                   shape) but its own contract re-verified
                                   fresh, not derived mechanically — 15
                                   error codes registered explicitly
                                   (2 with no Return equivalent:
                                   AGENT_TRANSFER_EXCEEDS_CAPACITY, a live
                                   grattage-capacity gate; TRANSFER_
                                   RECIPIENT_HAS_OUTSTANDING_OBLIGATION,
                                   the Grattage restock gate, surfaced
                                   reactively); validation_summary's own
                                   keys genuinely diverge from Return's
                                   ({line_count,total_quantity,montant} vs.
                                   {total_lines,total_quantity,
                                   total_montant}); VIEW_AGENT_TRANSFERS is
                                   PLURAL, unlike Return's singular
                                   equivalent; its own domain-local
                                   Manager->Commercial picker, NOT shared
                                   with Return's, ADR-0021; no proactive
                                   capacity hint built — reactive only, by
                                   decision)
├── allocations/            M5 Phase 4 — COMPLETE at the implementation
                                   level; Bons has since shipped, resolving
                                   the prior no-stock-source blocker (manual
                                   validation still owed, not blocked).
                                   Binding pair is company_id + agent_id
                                   (role=manager), NOT a manager<->commercial
                                   cascade — two plain independent selects;
                                   montant is LOAD-BEARING (diverges from
                                   Return's/Transfer's own metadata-only
                                   montant), driving a real deposit-
                                   capacity gate at validate; only 10 error
                                   codes (no role-mismatch family — a real
                                   contract fact, not incomplete); no
                                   Consumptions UI (show() never eager-
                                   loads that relation); "add line" product
                                   picker now reads GET /admin/companies/
                                   {company}/stock, not the unfiltered
                                   catalogue (ADR-0025)
└── bons/                   M5 Phase 5 — COMPLETE at the implementation
                                   level, manual validation owed but NOT
                                   blocked (Bons is the source of stock).
                                   The only Stock resource with a cancel
                                   lifecycle (BC-AB) and the only mandatory
                                   file upload (evidence); only 9 error
                                   codes, no BON_STOCK_INSUFFICIENT
                                   (validateBon has no capacity check at
                                   all — BON_CANCEL_STOCK_INSUFFICIENT,
                                   reachable only via cancel, is the sole
                                   stock-insufficiency gate here)

src/domains/grattage/
├── invoices/               M6 Phase 1 — COMPLETE (list/detail/cancel;
│                                  `access-dashboard`-gated, reusing the
│                                  existing constant; no admin Create or
│                                  Settle — both backend-initiated, out of
│                                  scope; list filters are page/status/
│                                  date-range only, no agent/client filter;
│                                  `depositId` row on the detail page links
│                                  to `/money/deposits/${id}` with a
│                                  status-aware label, M6 Phase 4)
└── outstanding/             M6 Phase 2 — COMPLETE, DATA LAYER ONLY, no
                                   page/route/component (deliberate — the
                                   per-agent Outstanding UI is an M7 Agent
                                   360 deliverable, not M6's). Exports ONLY
                                   the narrow `useGrattageRestockGateQuery
                                   (agentId)` (ADR-0026); the full
                                   `useGrattageOutstandingQuery` stays
                                   domain-private, unexported, no caller yet.
                                   Consumed by exactly one Stock page —
                                   `AgentTransferDetailPage` — the ONE
                                   sanctioned Stock←Grattage
                                   domain-to-domain import (ADR-0027). A
                                   second consumer briefly existed on
                                   `AllocationDetailPage` (M6 Phase 3) and
                                   was removed once backend commit `9af5d00`
                                   made its underlying gate non-authoritative
                                   (ADR-0028)
```

All five Stock resources are now implementation-complete. The
`src/domains/reference/companies/`-shaped directory pair is now FULLY
built: Companies (`GET /admin/companies`, M5 Phase 4) and Suppliers
(`GET /admin/suppliers`, M5 Phase 5) both exist, both read-only reference
endpoints by deliberate decision, never CRUD (ADR-0023). `allocation_number`/
`transfer_number` are backend-generated now (ADR-0024); Allocations'/
Transfers' own "add line" pickers read real per-owner availability instead
of the unfiltered product catalogue (ADR-0025). M6 added
`src/domains/grattage/` (Invoices, complete; Outstanding, data-layer-only
by decision — ADR-0026) and one Money-side private read inside
`src/domains/money/deposits/` (`fetchLinkedGrattageInvoices`, Option B,
ADR-0030) — no new top-level domain directory beyond `grattage/` itself.
