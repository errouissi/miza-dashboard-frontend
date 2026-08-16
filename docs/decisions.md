# Architectural Decision Log

**APPEND ONLY.** Never rewrite, never delete. A decision that turns out wrong gets a
*new* entry superseding it, and the old one stays with its status changed to
`Superseded by ADR-XXXX`.

**Numbering:** `ADR-0001` is the localStorage token decision, already written into the
frozen FTA §17. This log continues from `ADR-0002`. Decisions inside the frozen
documents are numbered `D-1 … D-17` and are **not** repeated here — this log records
decisions made *during implementation*.

**Status values:** `Accepted` · `Accepted (judgment)` · `Proposed` · `Superseded`

---

## ADR-0002 — Session as an external store, not React Context

- **Date:** 2026-07-18
- **Status:** Accepted (ratified retroactively; no ADR required at the time)
- **Context:** FTA's state table prescribes "one React Context, hydrated at bootstrap".
  M1-A shipped `useSyncExternalStore` with no Provider. The two disagreed and nothing
  reconciled them.
- **Decision:** The external store is the official architecture. Do not revisit.
- **Rationale:** A Provider must be mounted in `app/`, and `domains/` may not import
  `app/` (FTA §4) — so a domain could never read the session. It also removes a bug
  class: there is no Provider to forget.
- **Consequences:** FTA's state table is stale on this point. Session is read via
  `useSession()`/`usePermission()` from `shared/hooks`.

## ADR-0003 — Lazy session restoration; no boot-time `/me`

- **Date:** 2026-07-18
- **Status:** Accepted
- **Context:** On load the app trusts `localStorage` until a request 401s.
- **Decision:** Keep lazy validation. Do **not** add a boot-time `/me` gate.
- **Rationale:** A blocking validation request on every load costs a round-trip to
  prevent a brief optimistic render. The 401 path already terminates cleanly.
- **Consequences:** The shell can render as authenticated for one request cycle on a
  stale token. Accepted.

## ADR-0004 — One navigation authority for session end

- **Date:** 2026-07-18
- **Status:** Accepted
- **Context:** Logout could navigate directly, or rely on the 401 teardown path.
- **Decision:** `sessionManager.terminate()` → `wireSessionTermination` → navigate.
  Logout calls the API, then terminates, and performs **no** navigation of its own.
- **Rationale:** Two navigation paths race. One authority cannot.
- **Consequences:** Logging out from `/x` produces `/login?next=/x`, so signing back in
  returns you where you left. Deliberate.

## ADR-0005 — Plan B: reduced M2c extraction scope

- **Date:** 2026-07-18
- **Status:** Accepted
- **Context:** The roadmap's M2c names `DataTable`, `FilterBar`, `StatusBadge`,
  `MoneyAmount`, `EntityChip` and a resource-definition module. Measured across the
  three built resources: pagination/search/sort exist on **Villes only** (1/3),
  relation resolution on **Secteurs only**, money on **Products only**, statuses
  **nowhere**.
- **Decision:** Extract only the six components with 3/3 evidence. Defer the rest.
- **Rationale:** The roadmap's own method is *"the shape is evidence, not a guess."*
  Extracting a paginated table from one case is the failure it warns against.
- **Consequences:** `DataTable`/`FilterBar` move to M3 (see ADR-0006 stopping rules).
  Gate G2's criteria required amendment.

## ADR-0006 — Extraction stopping rules

- **Date:** 2026-07-19
- **Status:** Accepted
- **Decision:** Do not extract until the stated evidence exists:
  - `DataTable` — **3 genuinely paginated** resources
  - `FilterBar` — **3** with server-supported search or multi-filter
  - `StatusBadge` — **3** with real status *enums* (a boolean does not count)
  - `MoneyAmount` — **3** independent callers beyond `formatMoney`
  - `EntityChip` — **3** relation pickers
  - Resource-definition module — a 4th reference-shaped resource proving a stable config
  - URL-filter hook — a resource with 3+ filters
- **Rationale:** A resource whose backend cannot express a capability is not evidence
  for abstracting it. This is the BC-G lesson stated as a rule.
- **Consequences:** Secteurs and Products count toward *neither* `DataTable` nor
  `FilterBar`. Admins does **not** count toward `StatusBadge`.

## ADR-0007 — Cache tier classification

- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** `STALE_TIMES` enumerates SLOW as *"agent and client lists"*. Admins are
  neither, but sit in the same category.
- **Decision:**
  - **Reference data** (villes, secteurs, products) → `STATIC`
  - **Identity resources carrying account status** (admins, agents, clients) → `SLOW`
  - **Authorization vocabulary** (permission catalogue) → `STATIC`
- **Rationale:** STATIC's justification is "feeds every form's pickers; a stale name
  costs nothing". Neither holds for an account-status field. Staleness there is "an
  annoyance, not a financial error" — SLOW's own words.
- **Consequences:** Guidance for M3.2–M3.4. Financial queues remain `LIVE`;
  decision-critical reads remain `CRITICAL`.

## ADR-0008 — Map only consumed fields

- **Date:** 2026-07-19
- **Status:** **Accepted (judgment)** — deliberately *not* codified as a rule
- **Context:** Backends return fields no screen reads (`created_at`, `roles`,
  timestamps). Applied consistently in Products (M2b) and Admins (M3.1).
- **Decision:** A wire field is modelled when a screen reads it, not before. Unmapped
  fields are documented in the mapper with the reason.
- **Rationale:** A typed field becomes a de-facto contract — it invites use, must be
  maintained through backend changes, and leaks into tests.
- **Consequences:** Not yet a formal rule. **Revisit after M3.2–M3.4**; if Managers,
  Commercials and Clients follow it naturally, promote it then.
- **Note:** The "FTA D-11" shorthand for *no caller yet* is a **project convention**
  originating in commit `3646170`, not a literal reading of D-11's heading. Consistent
  across ten references; leave as-is unless changed project-wide.

## ADR-0009 — Expose only backend-supported capabilities

- **Date:** 2026-07-18
- **Status:** Accepted
- **Context:** Secteurs, Products and Admins index endpoints accept no pagination,
  search or sort parameters.
- **Decision:** Those screens render **no** search box, sortable header or pager. Never
  fabricate client-side pagination over a full-table fetch.
- **Rationale:** A control the API ignores misrepresents the system and hides the gap.
- **Consequences:** Reference-screen UX is heterogeneous (Villes has them, others do
  not). This is the visible cost of BC-G, and is the honest reflection of the API.

## ADR-0010 — Permission catalogue is the sole source of assignable permissions

- **Date:** 2026-07-19
- **Status:** Accepted (supersedes the M3.1 decision to omit the picker entirely)
- **Context:** B-6 shipped `GET /admin/permissions` → `{data:[{name,label,group}]}`,
  name ASC, gated `create-admin|update-admin`.
- **Decision:** The endpoint is the only source. Never hardcode, never infer, never
  derive from any user's grants, never filter client-side.
- **Rationale:** Deriving from super-admin was lossy — `create-grattage-sale` is seeded
  *after* the super-admin sync and so never appeared. Blank-named and non-assignable
  rows are excluded **server-side**.
- **Consequences:** The catalogue is gated more narrowly than the Admins list
  (`access-dashboard`), so the query must use `enabled` and fire only where the form is
  reachable — otherwise every read-only operator triggers a 403.

## ADR-0011 — `permissions` omitted from update unless changed

- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** `AdminController::update` calls `syncPermissions` whenever the key is
  **present**, and sync *replaces* the whole set. The catalogue is deliberately narrower
  than the validator.
- **Decision:** Send `permissions` on update **only** when the selection changed.
- **Rationale:** Otherwise a rename could silently strip a grant the picker cannot
  represent. Omitting the key leaves backend permission state untouched.
- **Consequences:** Create always sends the array (possibly empty); update sends it only
  on deliberate change. Both branches are pinned by tests.

## ADR-0012 — Duplication retained by decision

- **Date:** 2026-07-18
- **Status:** Accepted
- **Decision:** These stay **duplicated per domain**, indefinitely: API mappers ·
  query-key factories · permission checks · URL filter handling · validation schemas ·
  route paths · domain copy · error interpretation.
- **Rationale:** Mappers *are* the anti-corruption layer (FTA D-6) — merging them
  creates one module that must know every backend inconsistency. Key factories are four
  lines and fully typed. Permission checks are already one call.
- **Consequences:** Expect near-identical code across domains. That is the design.

## ADR-0013 — Domain folder organisation

- **Date:** 2026-07-19
- **Status:** Accepted
- **Decision:** `src/domains/<business-domain>/<resource>/` — `reference/` for lookup
  data, `network/` for the identity graph, matching the roadmap's domain names.
- **Rationale:** Feature-first (FTA D-2). The business domain, not the technical layer,
  is the top-level grouping.
- **Consequences:** Each resource keeps the same internal shape
  (`api/ model/ queries/ components/ pages/ routes.tsx index.ts`) and exports only its
  path and route contributions.

## ADR-0014 — M3 ships list management first; detail pages are a later milestone

- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** Two frozen documents specify a detail page for every Network resource:
  `phase8-architecture.html:650` — _"Admins, Managers, Commercials, Clients — full
  ListPage + DetailPage + forms"_ — and the roadmap's M3 deliverables (`:476`). M3.1
  nevertheless shipped Admins **list-only**, and nothing recorded that. The deviation was
  found during M3.2's contract verification, when FE-2 ("fix before shipping any detail
  page") had to be evaluated and no document said whether a detail page was in scope. An
  undocumented gap between the frozen specification and the code is the class of drift
  Gate G1 exists to catch, so it is recorded here rather than left implicit.
- **Decision:** M3 delivers **list management first** across its resources — list,
  pagination, search, filters, forms, status actions, permission gating. Admin and
  Manager **detail pages are deferred to a dedicated later M3 milestone**, not cancelled.
  The frozen documents remain authoritative about _what_ is built; this ADR records only
  _when_.
- **Rationale:** Sequencing, not scope reduction. The list resources share one shape, and
  building them consecutively is what makes ADR-0006's Rule-of-Three evidence accumulate
  on genuinely comparable cases. Detail pages are a different pattern, with a different
  blocker (FE-2) and a different backend surface
  (`GET /admin/agents/{identifier}`); batching them lets the nested-guard fix be made
  once, against a real nested route, rather than speculatively.
- **Consequences:**
  - Admin and Manager detail pages are **owed work**, tracked as a named later M3
    milestone. This ADR is not permission to drop them.
  - **FE-2 blocks those future nested detail routes, not the current list domains.**
    `withPermissionGuards` is shallow, so a child route's own `handle.permission` is
    silently ignored in favour of its parent's.
  - **FE-2 MUST be fixed before the first nested detail page is introduced.** A detail
    route added before that fix inherits its parent's guard — a silent authorization
    hole, not a cosmetic defect.
  - M3.2 (Managers) therefore ships with no detail page, no nested route and no
    detail-page link.

## ADR-0015 — `villeSousResponsabilite` multi-city encoding is a frontend-only convention

- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** The business rule was clarified: a manager may be responsible for
  multiple cities, not one. `agents.ville_sous_responsabilite` was verified from
  source before choosing anything — `create_agent_table.php:41` is a plain
  `string`, `nullable()` column with no cast in `Agent::$casts` and no
  accessor/mutator; every validator that touches it (`store()`, `update()`, the
  list filter) is `nullable|string|max:255`, never `array`; the list filter does
  a substring `LIKE` match over that one string; and the only sample value
  anywhere in the codebase (`DevAgentSeeder.php:75`) is a single bare name. The
  backend has no multi-value convention of its own — there was nothing existing
  to preserve.
- **Decision:** Multiple cities are encoded as `", "`-joined names within the
  same single string the backend has always accepted and validated
  (`parseVilleSousResponsabiliteAreas`/`serializeVilleSousResponsabiliteAreas`,
  `model/manager.ts`). This is a **frontend-only** convention layered over an
  **unchanged backend contract** — same endpoint, same field name, same
  payload type (a string), no migration, no new validation rule. The backend
  does not know its string now often holds several names.
- **Rationale:** The instructions offered comma-delimiting as the example
  convention when no existing one is found, and no Villes name contains a
  comma. Any other in-band delimiter would carry the same property; comma was
  not derived from evidence, it was picked because nothing ruled it out and it
  matches what was suggested. This is recorded so a future session does not
  mistake the delimiter for a backend fact and does not "fix" the field into
  an array without knowing the wire contract already forbids one.
- **Consequences:**
  - The multi-select UI (`ManagerAreaMultiSelect`) parses on read and
    serializes on write; it never sends an array, and the value submitted is
    byte-for-byte what `form.register` used to send for an untouched field.
  - Parsing trims and de-duplicates (first occurrence wins), and — critically
    — **normalisation runs the moment the form opens**, not only once the
    operator touches a checkbox, so a malformed legacy value (e.g. accidental
    duplicate names) is never resubmitted unchanged. A distinct legacy value
    (a real, singular name simply absent from the Villes options) is
    untouched by this and stays selected until explicitly unchecked.
  - Any other field encoding multiple values into one backend string in the
    future should default to reusing this same `", "` convention rather than
    inventing a second one, unless a real reason argues otherwise.

## ADR-0016 — M3.5 bulk-assign ships current-page-only selection; the frozen "all-pages" step is deferred, not built

- **Date:** 2026-07-23
- **Status:** Accepted (deliberate scope narrowing; owed work recorded)
- **Context:** Two frozen documents both name a capability M3.5 did not build.
  `phase8-frontend-implementation-roadmap.html`'s M3 deliverables list "Client
  bulk-assign — the first bulk action, exercising the 100-cap **and the
  deliberate all-pages selection step** (Design System §14)." Design System
  §14 itself specifies: "Header checkbox selects the current page
  (indeterminate for partial); **selecting all pages is a deliberate second
  step with an explicit count** — silent all-page selection on an action like
  bulk-assign is how accidents at scale happen," and that the bulk action bar
  should surface the 100 cap directly in the selection count ("100 max"), not
  only enforce it silently on failure. M3.5 shipped explicit, current-page-only
  selection with no all-pages step and no cap surfaced in the count copy —
  given as an explicit scope instruction before implementation, not derived
  from the frozen documents. The gap was found during this session's own
  doc-closure review, **after** implementation and manual validation had
  already passed — the M3.5 discovery pass itself did not cross-check the
  frozen roadmap's M3 section or Design System §14 before scope was fixed,
  which is the actual process gap worth naming for future discovery passes.
- **Decision:** M3.5 ships current-page-only selection as its real, final
  scope. The frozen documents' "all-pages, deliberate second step" and the
  "100 max" surfaced-count copy are **deferred, not built**, and recorded here
  as owed work rather than silently dropped — the same discipline ADR-0014
  used for the detail-page deferral.
- **Rationale:** Given explicitly, not re-derived: current-page-only is the
  simpler, safer v1 surface, and matches the frozen design's own underlying
  concern (accidental at-scale bulk actions) even though it satisfies that
  concern by omitting the wider capability entirely rather than by gating it
  behind the specified deliberate second step.
- **Consequences:**
  - **This is NOT the same gap as "select all matching filters,"** which the
    M3.5 discovery pass correctly ruled out as unbuildable without a backend
    change (`assignBulk` accepts only explicit `client_ids`, no filter
    object). The frozen spec's "all-pages" step is a **client-side** capability
    — walk every page of the current filtered view, union the ids, still cap
    at 100 for submission — genuinely buildable with today's contract. A
    future session must not conflate the two or assume "all-pages" requires a
    backend change.
  - Owed work for a later session, should the product want it: (1) an
    explicit "select all N across all pages" second-step action, distinct
    from the current per-page select-all, with its own confirmation given the
    100-cap risk; (2) surfacing "x / 100 max" in the bulk action bar's count
    copy, in place of the current plain count.
  - Future discovery passes must cross-check the frozen roadmap's milestone
    section AND the relevant Design System section(s) before fixing scope —
    not only the backend contract — so a frozen-document deviation is caught
    before implementation, not after.

## ADR-0017 — M3.6 onboarding success transitions to a dedicated screen, not the standard toast-and-navigate flow

- **Date:** 2026-07-24
- **Status:** Accepted
- **Context:** FTA §10 documents one standard write flow for the whole
  product, with no named exceptions until now: "(5) On success: invalidate,
  toast, and navigate or close per the flow." Every create/edit form built
  so far (Villes, Secteurs, Products, Admins, Managers, Commercials, Clients)
  follows it exactly. `AgentController::store`'s success response breaks the
  precondition that flow assumes: it returns a backend-generated account
  number (`MG#####`/`CM#####`) and an 8-character random plaintext password,
  both computed server-side, with no form field for either. `Agent::$hidden`
  excludes `password` from every subsequent read of the model — this
  response is the ONE time the plaintext password is ever transmitted. A
  toast is transient by design (Design System's own auto-dismiss behavior
  for success feedback) and `navigate` moves the operator away from the
  screen holding it. Combined, the standard flow would show the password for
  a few seconds, on a screen the operator is about to leave, with no way to
  ever see it again.
- **Decision:** A successful onboarding submission transitions to a
  **dedicated success screen** — the wizard does not toast-and-navigate.
  The screen displays the generated account number and password as
  persistent, selectable, individually copyable text, and stays on screen
  until the operator explicitly chooses to onboard another agent. Generic
  toast-only success handling is not sufficient for this one response and
  must not be substituted for it.
- **Rationale:** This is a genuine, deliberate exception to FTA §10's
  documented submission flow, not a UI preference — the standard flow's own
  assumptions (nothing shown on success is unrecoverable, so brief display
  plus navigation is safe) do not hold for a one-time plaintext secret. The
  exception is scoped as narrowly as the reason for it: only the credential
  display changes; validation, suspension, mutation semantics (never
  optimistic, never auto-retried) and failure handling (form stays open,
  everything intact) all still follow §10 exactly.
- **Consequences:**
  - Protects an unrecoverable credential from being lost to a fast toast
    dismissal or an automatic navigation the operator didn't ask for.
  - Establishes the pattern for any future endpoint that returns a
    comparable one-time, unrecoverable secret: use a dedicated success
    screen, not the standard toast-and-navigate flow. No such endpoint
    exists elsewhere in the product today; this is the first and only
    instance.
  - A future refactor of the wizard's submission handling MUST preserve the
    dedicated success screen unless the backend gains a safe way to
    retrieve or reset the credential after the fact (e.g. a proper
    reset-password flow) — at which point the tradeoff this ADR made should
    be re-evaluated, not silently reverted.
  - Does NOT apply to any other current or future form by default — the
    standard FTA §10 flow remains the norm everywhere else. This is a named
    exception, not a precedent for adding success screens generally.

## ADR-0018 — `useFreshConfirm`: the FTA §8 freshness rule as a shared hook, mandated not discovered

- **Date:** 2026-07-26
- **Status:** Accepted
- **Context:** FTA §8 mandates, product-wide: data gating an irreversible
  action MUST be refetched immediately before confirmation, and the dialog
  MUST refuse if the fresh read shows the record changed underneath the
  operator. Cheques' three status-action dialogs and Deposits' validate/
  reject dialogs each needed this identically. Building it separately per
  domain, the way `ConfirmActionDialog`'s own `Rule of Three` extraction
  precedent would suggest, would mean copying the same "checking / stale /
  unavailable" state machine at least five times before the third domain
  ever justified it.
- **Decision:** Extracted immediately, at two domains (Cheques, Deposits),
  not deferred to a third caller — the same class of decision
  `invalidation-map.ts` already made at M4.1 (shipped ahead of any real
  event). A cross-cutting policy a frozen document mandates uniformly is not
  a UI shape discovered by repetition, and CLAUDE.md's Rule-of-Three governs
  the latter, not the former.
- **Rationale:** Lives in `shared/hooks/`, not `shared/components/` —
  presentation-*adjacent*, not presentation-only: it owns the state machine
  and the explicit `refetch()` timing, but no query key, no fetch function,
  no domain type, and no copy (every message a dialog shows is the caller's
  own). The caller's freshness query **must use its own, distinct cache
  key**, never the host page's detail query's key — TanStack Query's error/
  success state is shared across every observer of one key, so sharing it
  would let a transient verification failure flip the host page's own
  display into an error state too (confirmed empirically while building the
  first two callers).
- **Consequences:** Reused unchanged by every Stock caller since
  (`ValidateReturnDialog`, `ValidateTransferDialog`) — five real call sites
  as of M5 Phase 2, all sharing the identical hook with no modification.
  Any future irreversible action anywhere in the product gating on stale
  data reuses this hook; do not hand-roll a parallel "checking/stale"
  state machine inside a new dialog.

## ADR-0019 — `LineItemsEditor` extracted at its first caller, justified by a verified contract, not reuse count

- **Date:** 2026-07-26
- **Status:** Accepted
- **Context:** Stock's four movement types (Bons, Allocations, Agent
  Transfers, Agent Stock Returns) each need an add/edit/remove line editor
  for a draft document. Only one of the four (Agent Stock Returns) had been
  built when this component was written.
- **Decision:** Extract to `shared/components/business/` at the FIRST
  caller, not the third — because the line CONTRACT (`product_id`,
  `quantity`, `unit_cost`, `notes`) was independently verified, from
  source, to be IDENTICAL across all four movement types' own FormRequests
  (`StoreBonLineRequest`/`StoreAllocationLineRequest`/
  `StoreAgentTransferLineRequest`/`StoreAgentStockReturnLineRequest`)
  before extraction, not assumed from resemblance.
- **Rationale:** The same reasoning ADR-0018 already applied to
  `useFreshConfirm`: CLAUDE.md's Rule-of-Three governs abstractions
  discovered by repetition across independently-evolving call sites: a
  contract PROVEN uniform ahead of time, from the backend's own validators,
  is not the same kind of bet. Presentation-only, the same boundary
  `ConfirmActionDialog` holds — no mutation, no query client, no domain
  type (`productId`/`unitCost` are generic fields, not Stock-specific
  knowledge); the caller owns every mutation and its pending/error state.
- **Consequences:** Product is deliberately NOT editable on an existing
  line, even though some backends' `UpdateXLineRequest` allow it — a
  narrower surface than the backend permits, revisit only if a real caller
  needs in-place product changes. Reused unchanged by Agent Transfers (M5
  Phase 2), the second real caller; Allocations and Bons (both still
  pending) are expected to reuse it unchanged too — if either needs a
  materially different line shape, that is new evidence to weigh against
  this ADR, not a silent fork.

## ADR-0020 — `ConfirmActionDialog` stays presentation-only through every extension; extend, never fork for a business rule

- **Date:** 2026-07-26
- **Status:** Accepted (reaffirms and generalizes the M2c extraction boundary)
- **Context:** `ConfirmActionDialog` picked up four additive props across
  M4.2 Phase 3C (`variant`, `reason`, `confirmDisabled`, `children`), each
  driven by a real domain need (Cheques' Approve/Reject/Annuler). Every
  subsequent irreversible-action confirmation in the product (Deposits'
  validate/reject, Stock's validate-return/validate-transfer) reused the
  same component, still with zero business logic inside `shared/`.
- **Decision:** `ConfirmActionDialog` may keep growing additive, generic
  props (a label, a boolean, a slot) as new callers need them, but must
  NEVER gain a prop that names a domain concept (no `chequeId`, no
  `allocationSplit`, no `productLine`). The caller always computes its own
  validity, its own copy, and its own error message; the component only
  renders what it is given.
- **Rationale:** A version that inspected an `AppError` or computed
  business validity itself would need to know what it was confirming —
  domain knowledge `shared/` may not hold (FTA §4, CLAUDE.md's "no business
  logic in `shared/`"). Keeping the boundary strict is what let FOUR
  different financial actions across two domains (and now two Stock
  validate dialogs) reuse one component instead of forking near-identical
  copies.
- **Consequences:** Any future action needing dialog behavior this
  component cannot express (e.g. a genuinely different layout, not just
  different content) is a signal to design a new, separate component — not
  to smuggle a domain conditional into this one. Eight-plus callers deep as
  of M5 Phase 2, none of which have ever needed to reach into the
  component's own internals.

## ADR-0021 — The Manager → Commercial cascading picker stays domain-local, duplicated per resource

- **Date:** 2026-07-26
- **Status:** Accepted
- **Context:** Both Agent Stock Returns and Agent Transfers need a Manager
  select whose Commercial select is scoped to guarantee
  `commercial.manager_id === manager_id` by construction (via
  `GET /admin/agents/{manager}/sub-data`), because each resource's own
  creation FormRequest asserts that exact binding. `ReturnManagerCommercial
  Field`/`fetchManagerCommercials` (Return) and `TransferManagerCommercial
  Field`/`fetchManagerCommercials` (Transfer) are near-identical, domain-
  local copies — a real candidate for extraction on reuse-count grounds
  alone.
- **Decision:** Kept duplicated, one copy per domain. **Allocation's own
  binding rule was independently re-verified and uses a completely
  different counterpart pair** (`company_id` + `agent_id(role=manager)` —
  no manager↔commercial relationship at all), so this specific pattern has
  a hard ceiling of TWO consumers in the entire frozen roadmap, confirmed
  by checking every remaining Stock movement type, not assumed from the
  two that already exist.
- **Rationale:** ADR-0012's own duplication list plus CLAUDE.md's
  Rule-of-Three: two genuinely comparable, permanent consumers is
  short of three, and a ceiling of two verified from the roadmap itself
  means a third will never arrive to retroactively justify an extraction.
  Duplication is the cheaper, correct choice here, not a shortcut.
- **Consequences:** Do not merge `ReturnManagerCommercialField` and
  `TransferManagerCommercialField` (or their sub-data fetchers) into one
  shared component or shared query, even though they are near-identical
  today. If a future backend change gives Allocations (or any other
  resource) the same manager↔commercial binding rule, re-open this
  decision explicitly rather than assuming the ceiling still holds.

## ADR-0022 — The backend is the sole source of truth for contract facts; no document, including this log, may substitute for reading it

- **Date:** 2026-07-26
- **Status:** Accepted (formalizes a discipline already applied at every
  milestone since M1, recorded once it produced a specific, recurring
  category of correction worth naming)
- **Context:** Every milestone from M3.3 onward independently re-verified
  its own backend contract from source rather than inheriting the previous
  resource's shape by resemblance — and every one of them found at least
  one genuine divergence: Commercials' filter semantics differed from
  Managers'; Clients' `index()` skipped `transform()` entirely; Deposits'
  `DepoResource` changed shape mid-milestone (commit `8786326`) after the
  M4 discovery pass had already read it once; Agent Transfer's error codes
  and `validation_summary` keys were confirmed to diverge from Agent Stock
  Return's superficially similar ones in specific, named ways
  (`TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID`'s `RECIPIENT_` infix,
  `AGENT_TRANSFER_EXCEEDS_CAPACITY`'s different code prefix,
  `{line_count, total_quantity, montant}` vs. `{total_lines, total_quantity,
  total_montant}`). In every case, copying the nearest sibling's contract
  instead of re-reading source would have shipped a silent defect.
- **Decision:** No frozen document, living document (including this one),
  prior session's implementation, or sibling resource's shape is ever
  treated as authoritative about what the backend actually does. The
  controller, the FormRequest, the model, and — where reachable — the live
  endpoint are read fresh at the start of every phase that touches a new
  contract surface, even when a very similar resource was just built.
- **Rationale:** `session-bootstrap.md` already states this as the single
  most-weighted working principle ("What does the API actually do? — the
  backend source, then the live endpoint. No document is authoritative
  about backend behaviour — only the backend is"). This ADR exists to give
  that standing rule a permanent, citable decision record, since by M5 it
  had already prevented multiple would-be defects (see Context) and is
  worth protecting explicitly rather than leaving as prose alone.
- **Consequences:** A "mechanical rename" from one resource's contract to
  a similar one's (e.g. `RETURN_*` → `TRANSFER_*` error codes) is
  explicitly disallowed as a shortcut — every code, field name and
  validation rule for a new resource is registered from its own verified
  source. This does not forbid reusing a *pattern* (a hook, a component, a
  file structure) once its own contract-independence is established — only
  forbids assuming a *specific contract fact* carries over unchecked.

## ADR-0023 — Companies/Suppliers are minimal, read-only reference endpoints, never CRUD

- **Date:** 2026-08-05
- **Status:** Accepted
- **Context:** Allocations (M5 Phase 4) needed a `company_id` picker with no
  existing backend list endpoint (B-1, open since M0). Bons (M5 Phase 5)
  needed the identical thing for `supplier_id`. Both `companies` and
  `suppliers` are seeded once (`Phase4ASeeder`) and never edited afterward.
- **Decision:** Each gets exactly one endpoint — `GET /admin/companies` /
  `GET /admin/suppliers` — read-only, unpaginated, `access-dashboard`,
  filtered to `active=true`, returning only `{id, name, code, active}`.
  Mirrors `SecteurController::index()`'s own minimal shape. No
  `store`/`update`/`destroy` route was added for either, and none is
  planned — a full CRUD surface was explicitly considered and rejected as
  scope neither resource needs.
- **Rationale:** The frontend counterpart
  (`domains/reference/companies/`, `domains/reference/suppliers/`) is
  deliberately narrower than Villes/Secteurs/Products for the same reason:
  no list page, no routes, model/api/queries/index only — there is no
  screen to manage either from, because neither is dashboard-managed data.
- **Consequences:** If a future resource needs a `supplier_id`/`company_id`
  picker, reuse `useCompanyOptionsQuery`/`useSupplierOptionsQuery`
  unchanged — do not add a third, parallel reference module. Do not build
  create/edit/delete for either without a fresh, explicit decision; the
  seeded-reference-data premise this ADR rests on would need to change
  first.

## ADR-0024 — `allocation_number`/`transfer_number` are backend-generated; client input removed entirely

- **Date:** 2026-08-05
- **Status:** Accepted
- **Context:** Both fields were originally client-supplied, required,
  unique text inputs (M5 Phases 2 and 4). The backend introduced
  `DocumentNumberService` (`{PREFIX}-{ULID}, e.g. `ALLOC-…`/`TRF-…`) and
  removed both fields from `StoreAllocationRequest`'s and
  `StoreAgentTransferRequest`'s own validators entirely — not merely made
  them optional. Any value a caller still sent would be silently ignored.
- **Decision:** The number input was removed from both create forms
  entirely — not hidden, not disabled — and neither `createAllocation` nor
  `createAgentTransfer` sends the field anymore. The corresponding
  "duplicate number" 422 field-mapping and its dedicated test were removed
  too: with no form field to bind the error to, and a collision bounded at
  three server-side regeneration attempts, there is no user-facing case
  left to guard against.
- **Rationale:** Sending a field the backend no longer accepts, or
  displaying an input for a value the operator no longer controls, would
  misrepresent the contract (ADR-0009's own discipline, applied to a
  removed capability rather than a missing one).
- **Consequences:** Any FUTURE Stock resource needing its own document
  number should default to the same `DocumentNumberService`-generated
  pattern unless a real reason argues for operator-supplied numbers
  instead — that would be a deliberate reversal of this decision, not a
  fresh default.

## ADR-0025 — Per-owner stock endpoints are the source of truth for "add line" product pickers; kept domain-local

- **Date:** 2026-08-05
- **Status:** Accepted
- **Context:** Allocations' and Agent Transfers' own "add line" pickers
  used `useProductOptionsQuery()` (the full, unfiltered product catalogue)
  because no availability-scoped read existed (BC-AA). The backend added
  `GET /admin/companies/{company}/stock` and
  `GET /admin/managers/{manager}/stock` — both read-only, both pre-filtered
  to `available_quantity > 0` server-side — giving each resource a real
  source of truth for "can this product actually be moved right now."
- **Decision:** `AllocationDetailPage`/`AgentTransferDetailPage` now build
  their `LineItemsEditor` `productOptions` from `useCompanyStockQuery`/
  `useManagerStockQuery` instead. Both reads live domain-locally
  (`domains/stock/allocations/api/company-stock-api.ts`,
  `domains/stock/agent-transfers/api/manager-stock-api.ts`), NOT inside
  `domains/reference/companies/` or Network's Managers — the same
  ADR-0021 reasoning class: the read exists because of each Stock
  resource's own "add line" picker, not because Companies/Managers gained
  a new public concern.
- **Rationale:** These are genuinely DEPENDENT queries (they only fetch
  once the parent Allocation/Transfer resolves and its `companyId`/
  `managerId` is known), unlike the independent `useProductOptionsQuery()`
  they replaced — tests that assumed the product option was already
  rendered the instant the picker appeared had to start explicitly
  awaiting the option itself, not just the picker's own presence.
- **Consequences:** BC-AA is now PARTIALLY resolved — proactive,
  real-availability product pickers are possible and now built for
  Allocations/Transfers specifically. It is NOT fully resolved: neither
  endpoint is a general cross-owner Stock ledger view, and Return's/Bons'
  own product pickers still use the unfiltered catalogue by choice (out of
  this change's scope — revisit only with a fresh, explicit decision, not
  as a side effect of unrelated work).

## ADR-0026 — Grattage Outstanding: a private full read plus one narrow public hook; the per-agent UI is an M7 concern, not M6's

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** M6 Phase 2 needed to expose the Grattage restock-gate signal
  (`blocked`/`reason`, sourced from `GET /admin/agents/{agent}/grattage-outstanding`)
  to Stock, but the full Outstanding read also carries a per-agent list of
  undischarged invoices with no consumer yet — the frozen roadmap's own
  per-agent Outstanding-obligation view is explicitly an M7 Agent 360
  deliverable, not an M6 one.
- **Decision:** `domains/grattage/outstanding/` builds the full mapped read
  (`fetchGrattageOutstanding`, `useGrattageOutstandingQuery`) but its
  `index.ts` exports **only** the narrow, `select`-projected
  `useGrattageRestockGateQuery(agentId)`. `useGrattageOutstandingQuery`
  stays domain-private and unexported until an M7 caller actually needs it.
  Both hooks share one cache key
  (`grattageOutstandingKeys.detail(agentId)`), so a future page consuming
  both never double-fetches.
- **Rationale:** Building the full data layer once (rather than twice, once
  narrow for M6 and again broad for M7) avoids rework, but exporting the
  broad surface ahead of a real caller would be exactly the kind of
  speculative shared surface ADR-0008/D-11 already forbid elsewhere in this
  codebase. The module boundary keeps the "what M6 needs" and "what M7 will
  need" distinction enforceable by the compiler, not just documentation.
- **Consequences:** M7's own Agent 360 Outstanding view starts by exporting
  `useGrattageOutstandingQuery` from this same `index.ts` — no new
  `api`/`model`/`queries` files, just a widened public surface at the point
  a real page needs it.

## ADR-0027 — Stock←Grattage: exactly one sanctioned domain-to-domain import, consumed by Agent Transfer only

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** FTA §4's "mechanism 2" allows one deliberate domain-to-domain
  import where a genuine cross-domain business rule exists. Grattage's
  restock gate is exactly this: Stock's own `validateTransfer()`/
  `validateAllocation()` both, at the time of M6 Phase 3's initial
  implementation, blocked on a commercial's/manager's team's undischarged
  grattage obligation.
- **Decision:** `AgentTransferDetailPage` imports
  `useGrattageRestockGateQuery` from `domains/grattage/outstanding` — the
  ONE sanctioned Stock←Grattage import in the codebase. No other Stock
  resource (Agent Stock Returns, Bons) imports anything from Grattage;
  confirmed via negative-scope tests that neither requests the endpoint.
- **Rationale:** A single, narrow, `select`-projected hook is a much smaller
  surface than importing Grattage's full Outstanding shape, and keeping the
  import count at exactly one (enforced by review, not tooling — see the
  ESLint gap recorded in `next-session.md`) keeps the boundary auditable by
  grep alone.
- **Consequences:** Allocation briefly became a SECOND consumer of this same
  hook (M6 Phase 3's own initial implementation) and was removed once its
  underlying backend gate stopped being authoritative for Allocation — see
  ADR-0029. This ADR's "consumed by Agent Transfer only" statement is the
  CURRENT, post-correction state, not the mid-milestone one.

## ADR-0028 — Agent Transfer's Grattage restock-gate hard block is unaffected by the Allocation contract change and stays as built

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** Backend commit `9af5d00` changed Allocation's own capacity
  rules mid-milestone (see ADR-0029). Before correcting Allocation, a
  re-verification-only pass confirmed from source that
  `StockService::validateTransfer()` STEP 7c — the hard block on
  `GrattageInvoice::undischarged()->where('agent_id', $commercialId)`,
  surfaced as `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION` (409) — was
  untouched by that commit.
- **Decision:** `AgentTransferDetailPage`'s restock-gate integration (the
  proactive `useGrattageRestockGateQuery` call, the warning banner, and the
  `restockGateBlocked` prop into `ValidateTransferDialog`'s
  `confirmDisabled`) is left exactly as M6 Phase 3 built it. Nothing about
  Transfer changed during the Allocation correction.
- **Rationale:** Conflating Transfer's and Allocation's gates because they
  share one hook would risk an accidental regression during the Allocation
  fix — verifying and explicitly recording that they are independent
  contracts, on different backend code paths, protected this from
  happening.
- **Consequences:** `useGrattageRestockGateQuery`'s only remaining call site
  is `AgentTransferDetailPage` (ADR-0027). A future change to Transfer's own
  gate needs its own fresh backend re-verification — it must never be
  assumed stable just because Allocation's own equivalent gate turned out
  not to be.

## ADR-0029 — Allocation's proactive restock-gate integration is removed following backend commit `9af5d00`; the reactive capacity gate is now the only one

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** Backend commit `9af5d00`
  (`feat(allocation): settlement-aware Company -> Manager grattage
  capacity`) deleted `AllocationTeamHasOutstandingObligation` as an
  exception class outright and removed `validateAllocation()`'s team-wide
  hard block. M6 Phase 3 had already shipped a proactive frontend
  integration mirroring that exact block
  (`useGrattageRestockGateQuery(allocation.agentId)` on
  `AllocationDetailPage`, disabling Validate on
  `TEAM_OUTSTANDING_GRATTAGE`). The backend's own
  `computeGrattageRestockGate()` docblock now explicitly states the
  manager-level reason is "NOT AUTHORITATIVE" for Allocation.
- **Decision:** Removed entirely, not adapted: the hook call, the warning
  banner, and the `restockGateBlocked` prop on both
  `AllocationDetailPage` and `ValidateAllocationDialog`; the
  `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` entry in
  `error-code-registry.ts`; the five gate-specific tests in
  `allocation-detail-page.test.tsx`, replaced with one negative-scope test
  proving the gate is genuinely no longer consumed. `model/allocation.ts`'s
  and `AllocationDetailPage`'s own docblocks were rewritten to describe the
  current capacity formula and this history.
- **Rationale:** A gate the backend itself now documents as non-authoritative
  for this actor must not keep disabling a real action on the frontend —
  that would be a frontend-invented false refusal, the opposite failure mode
  from missing a real one. Removing rather than reinterpreting the signal
  also avoids inventing a new client-side meaning for a field the backend
  no longer intends to be load-bearing here.
- **Consequences:** Allocation's only remaining validate-time gate is the
  reactive `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` 409 — see ADR-0032 for the
  standing rule this establishes about not re-deriving that number
  client-side. `AllocationDetailPage` no longer imports anything from
  `domains/grattage` (confirmed by grep) — `AgentTransferDetailPage` is now
  the only remaining Stock←Grattage import site (ADR-0027).

## ADR-0030 — Deposit ↔ Grattage Invoice linking uses a private, domain-local read inside Deposits (Option B), not a new Money↔Grattage domain import

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** M6 Phase 4 needed `DepositDetailPage` to show the Grattage
  invoices a given grattage deposit reconciles/settles. Three options were
  presented: (A) extend Grattage's own public surface with a
  by-deposit-id query for Deposits to import; (B) build a private,
  domain-local duplicate read inside Deposits, mirroring the pre-existing
  M4.3 `fetchGrattageOutstanding` precedent already living there; (C) a
  hybrid.
- **Decision:** Option B, explicitly chosen by the user over A and C.
  `domains/money/deposits/api/deposits-api.ts` gained
  `fetchLinkedGrattageInvoices(depositId)` (`GET /admin/grattage-invoices
  ?deposit_id=...`, using the new backend filter from commit `057c8b2`) and
  its own narrow `LinkedGrattageInvoice` type (`id`, `status`,
  `totalAmount`, `soldAt` only) — not an import of Grattage's own
  `GrattageInvoice` model type.
- **Rationale:** A is a real Money→Grattage architectural edge, on top of
  the already-existing Stock←Grattage one — two live cross-domain couplings
  instead of one is more surface than this seam needs, and would make a
  future domain-boundary lint rule harder to write. Option B costs a small
  amount of duplication (a second place that knows the shape of a Grattage
  invoice, narrowly) in exchange for zero new domain edges — the same
  trade-off ADR-0012 already made for domain-local mappers/key-factories.
- **Consequences:** Deposits and Grattage now both independently read
  `GET /admin/grattage-invoices`, each mapping only the fields their own
  page needs. Cross-page navigation (Invoice→Deposit, Deposit→Invoices) is
  built as literal path strings (`/money/deposits/${id}`,
  `/grattage/invoices/${id}`), never a route-module import — mirroring
  `invalidation-map.ts`'s own pre-existing literal-key precedent. A future
  domain needing the same Grattage invoice data should default to this same
  private-read pattern unless a fresh decision says otherwise (see
  `next-session.md`).

## ADR-0031 — The Grattage Invoice detail page's deposit link uses a status-aware "Reconciliation" / "Settling" label, not a generic "Deposit" label

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** `deposit_id` is set on a `GrattageInvoice` at deposit
  **creation** time (before that deposit is ever validated), but the
  invoice's own `status` only flips to `settled` once the deposit is
  **validated** (`DepositService::createGrattageReconciliation()`/
  `validate()`, verified from source). A single generic "Deposit #N" label
  would be accurate at both points but would obscure this timing gap — an
  operator could read "Deposit #N" on a still-pending invoice and
  reasonably assume it was already settled.
- **Decision:** `GrattageInvoiceDetailPage`'s deposit link's label is
  computed from the invoice's own `status`:
  `invoice.status === "settled" ? "Settling deposit #N" : "Reconciliation deposit #N"`.
- **Rationale:** The two-word label is cheap and makes the
  creation/validation timing gap visible in the UI instead of only in this
  document — an operator reading "Reconciliation deposit #12" on a still-
  `pending` invoice correctly understands the deposit exists but has not yet
  discharged the invoice.
- **Consequences:** Any future page rendering a Grattage invoice's own
  deposit link should reuse this same status-aware convention rather than
  inventing a third label — there is no shared component for it yet (a
  single caller, per ADR-0008/D-11's own restraint on premature extraction).

## ADR-0032 — The backend is the sole authority for Allocation's (and any future Stock resource's) numeric capacity; the frontend never re-derives it from deposits, invoices, or movements

- **Date:** 2026-08-08
- **Status:** Accepted
- **Context:** Established directly out of the ADR-0029 correction: once the
  proactive team-obligation gate was removed, it would have been possible
  to instead build a client-side approximation of the manager's available
  grattage-deposit capacity (summing validated deposits, subtracting
  validated allocations) to restore some proactive UX. This was explicitly
  considered and explicitly rejected.
- **Decision:** Do not compute Allocation's (or any future Stock resource's)
  available capacity on the frontend from raw deposit/invoice/movement
  data. The number is only ever known correctly, at the moment it matters,
  inside `AllocationExceedsDepositCapacity`'s own exception `context`
  (`{agentId, requested, available}`) — a genuine 409 refusal is the sole
  source of this number today, and the frontend surfaces it reactively,
  never proactively.
- **Rationale:** The capacity formula is genuinely backend-owned business
  logic (it already changed once, unannounced from the frontend's
  perspective, in `9af5d00`) — a client-side reimplementation would silently
  drift from the real formula the next time the backend changes it again,
  producing a UI that confidently shows a wrong number instead of honestly
  showing none. This mirrors the same restraint already applied to
  Transfer's own `AGENT_TRANSFER_EXCEEDS_CAPACITY` gate, which has never had
  a proactive hint either.
- **Consequences:** BC-AA stays partially open specifically on this point —
  a proactive capacity hint remains impossible until the backend exposes a
  real read for it. Test fixtures for `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY`
  must construct the 409's `context` directly rather than deriving it from
  simulated deposit/allocation totals, so the tests cannot drift into
  encoding the formula themselves.

## ADR-0033 — M7 Agent 360's completion item: the zero-stock Manager reassignment guard, Commercial Available Grattage, and the Commercial product-level stock breakdown are each backend-authoritative, single-query, and never re-derived client-side

- **Date:** 2026-08-09
- **Status:** Accepted
- **Context:** M7 Phase 1.5 (`21c6e05`) excluded `manager_id` from Agent
  Edit — a temporary exclusion (informally tracked as "D2" during that
  phase's own approval, never promoted to its own ADR), not a scope
  decision: the frozen architecture (§6) names "Zero-stock reassignment
  guard" as an explicit Stock→Network cross-domain workflow ("Reassigning a
  commercial's manager is backend-blocked while they hold stock. The Agent
  edit form shows the live Stock balance inline and disables the manager
  field with an explanation"), and the exclusion existed only because no
  authoritative Commercial stock read existed yet. A completion review
  confirmed this was the milestone's one genuine gap against that frozen
  requirement and it was built as the closing item rather than deferred
  again. Two further backend widenings of the same endpoint
  (`f9a6fe4` — `available_grattage`; `15aa704` — `stock`, the per-product
  breakdown) landed during the same completion pass, each verified from
  source before use, never assumed.
- **Decision:**
  - `GET /admin/agents/{agent}/stock-quantity` (backend commit `5302f99`,
    Commercial-only, `access-dashboard`) is the ONE query
    (`useCommercialStockQuantityQuery`, `LIVE` tier) behind all three
    capabilities below — never three separate reads.
  - The zero-stock reassignment guard depends ONLY on `stock_quantity === 0`
    (`ManagerReassignmentField`, `agent-edit-drawer.tsx`) — fail-closed on
    loading/error/no-`access-dashboard`. Verified twice not to have
    regressed as the same endpoint grew two more fields.
  - Available Grattage (`available_grattage`, a bcmath decimal string
    produced by the newly extracted `StockService::commercialAvailableGrattage()`
    — the SAME formula `validateTransfer()`'s own STEP 7b capacity gate now
    calls) is rendered verbatim in the Commercial Stock panel — never
    parsed to a number, never combined with `montant_avance_grattage`,
    Transfers, Returns, Deposits, or Grattage Outstanding.
  - The Commercial product-level stock breakdown (`stock`, identical row
    shape to `GET /admin/managers/{manager}/stock`) is rendered through
    `StockProductTable`, a small presentational component now shared
    verbatim between Manager's and Commercial's own Current Stock — the
    query/loading/error/empty-state logic around it stays separate per
    caller (genuinely different copy and surrounding sections), not forced
    into one component.
  - `AgentOutstandingPanel` (inside `network/agents`) imports
    `useGrattageOutstandingQuery` from `domains/grattage/outstanding` — the
    THIRD sanctioned domain-to-domain import in the codebase (Network←Grattage,
    mechanism 2, FTA §4), alongside the pre-existing Stock←Grattage
    (ADR-0027) and Money↔Grattage-via-private-read (ADR-0030) patterns.
    This fulfills ADR-0026's own carried-forward plan: `useGrattageOutstandingQuery`
    is exported from its previously domain-private `index.ts` for the
    first time, for this real caller.
- **Rationale:** Every one of these three fields is genuinely backend-owned
  business logic that has already changed shape twice in one milestone
  (`5302f99` → `f9a6fe4` → `15aa704`) — the same restraint ADR-0032 already
  established for Allocation's capacity gate applies identically here: a
  client-side reimplementation would silently drift the next time the
  backend changes the formula again, producing a UI that confidently shows
  a wrong number instead of honestly deferring to the backend. Keeping all
  three behind one query, one cache key, and one staleness lifecycle
  reflects that they are one backend read, not three.
- **Consequences:** The zero-stock guard's own test suite includes an
  explicit adversarial case (`stock_quantity === 0` with
  `available_grattage === "0.00"`) proving the guard never reads the
  second field. No new invalidation-map entries were needed — all three
  fields are derived from the identical `listOwnerStock()` call the
  pre-existing `agent-transfer.validated`/`agent-stock-return.validated`/
  `grattage-invoice.cancelled` events already bust. A future session adding
  a fourth field to this same endpoint should extend the same snapshot
  type and the same query, not create a new one.

## ADR-0034 — `FormDrawer`'s scroll fix uses `overflow-clip`, not `overflow-hidden`; `FileUploadField`'s status/preview elements stay permanently mounted, never conditionally torn down

- **Date:** 2026-08-09
- **Status:** Accepted
- **Context:** M7 Agent 360's manual QA found a real defect: a form taller
  than `FormDrawer`'s own sheet viewport (Agent Edit, the first form in the
  product long enough to trigger it) pushed the header and Save/Cancel
  footer out of reach. A first fix (`min-h-0 flex-1` on the form and a
  dedicated scrollable field region, plus `overflow-hidden` on the sheet
  content as a defensive containment measure) genuinely fixed the
  scrolling — this was the first modification to `FormDrawer` since its
  M2c extraction. Manual QA then found a SECOND, real defect on top of the
  first fix: selecting a replacement Photo inside the now-scrollable drawer
  visually blanked the entire panel. This was reproduced live in Chrome
  (jsdom cannot simulate the mechanism) before any fix was attempted, per
  explicit instruction not to patch around an unverified cause.
- **Decision:**
  - `SheetContent`'s className uses `overflow-clip`, not `overflow-hidden`.
    Root cause, confirmed by direct DevTools measurement before and after:
    `overflow-hidden` is still a genuine CSS scroll container per spec (a
    real `scrollTop`, no visible scrollbar, no user-driven wheel/drag
    scroll, but still a valid target for the browser's native "scroll the
    focused element into view" behavior). The hidden file `<input>`
    regains focus the instant the native OS picker returns a selection;
    since it sits inside both the intended `.overflow-y-auto` region and
    the outer `overflow-hidden` container, the browser's focus-scroll walk
    adjusted the OUTER container's own `scrollTop` too (measured: `0` →
    `920`), clipping the whole visible panel into blank space.
    `overflow: clip` clips identically for containment but is explicitly
    NOT a scroll container by spec — confirmed live, `scrollTop` stayed
    `0` after the fix, same repro steps.
  - `FileUploadField`'s status text, "Remove" button, and preview
    `<img>`/`<a>` are now permanently mounted, toggling the `hidden`
    attribute instead of being conditionally rendered in and out across
    `value`/`existingUrl` transitions.
- **Rationale:** The second decision is independently justified, not merely
  a belt-and-suspenders reaction to the first bug — it was NOT the cause of
  the scrolling defect (confirmed empirically: replacing this component's
  DOM-churn pattern alone did not fix the blank-panel bug; `overflow-clip`
  did). It is kept because it closes a real, separately-verified defect
  class: Radix `FocusScope`'s own `MutationObserver` watches a trapped
  dialog's entire subtree and forcibly refocuses the dialog container the
  instant it sees ANY removed node while `document.activeElement` is
  transiently `document.body` — exactly what a native OS file-picker round
  trip produces. Keeping the node count and types stable (attribute
  patches only) never gives that observer a `removedNodes` event to react
  to, independent of whether `FormDrawer` itself is ever affected again.
- **Consequences:** Every existing `FormDrawer` caller (Villes, Secteurs,
  Products, Managers, Commercials, Clients, Admins, the client bulk-assign
  sheet) is visually unaffected — only a field list taller than the
  viewport (Agent Edit today) newly scrolls instead of clipping. A
  regression test (`form-drawer.test.tsx`) pins the structural invariant
  jsdom CAN prove (the footer is a DOM sibling of the field region, never
  a descendant) since jsdom cannot simulate the real scroll/focus
  mechanism itself. `file-upload-field.test.tsx` gained a `MutationObserver`-based
  test mirroring Radix's own detection logic, proving zero `removedNodes`
  mutations across a replacement, a second replacement, and a full
  select→Remove→select round trip. Any future shared-pattern component
  rendered inside a trapped Radix `Dialog`/`Sheet` should default to the
  same "stable node count, `hidden`-toggled" discipline for any element
  that can gain/lose focus mid-interaction.

## ADR-0035 — Client 360's Commercial reassignment uses `PATCH /admin/clients/{id}/assign` exclusively; `POST` to the same path is never called

- **Date:** 2026-08-11
- **Status:** Accepted
- **Context:** `ClientController` exposes TWO genuinely different endpoints
  at the identical path `/admin/clients/{id}/assign`, distinguished only by
  HTTP method — found during Client 360 Phase 2 discovery, re-verified from
  source before implementation: `POST` (`assignToAgent`, the legacy
  single-assign action) routes through `ClientAssignmentService::assign()`,
  which ALSO silently overwrites `ville`/`secteur` from the target
  Commercial; `PATCH` (`reassign`, the admin-facing action) routes through
  `reassignTo()`, which touches `agent_id` ONLY and never branches on
  whether the Client was previously assigned. Both existed before Client
  360; M3.5's own bulk-assign (`PATCH /admin/clients/assign-bulk`) already
  established the `agent_id`-only precedent this decision extends to the
  single-Client case.
- **Decision:** `ClientReassignDrawer`'s own mutation
  (`useReassignClientMutation` → `reassignClient`) calls `PATCH
  /admin/clients/{id}/assign` ONLY. `POST` to the same path is never called
  from Client 360, for either the "Assign" or "Reassign" UI label — one
  mutation serves both, since `reassignTo()` has no branch on the Client's
  prior `agent_id`.
- **Rationale:** An admin reassigning a Client's Commercial from the
  dashboard must never silently rewrite that Client's own City/Sector as a
  side effect — that is exactly the semantic `POST`'s own service method
  carries, and it would surprise an operator who only intended to change
  ownership. `PATCH`'s error contract is also strictly better (a real,
  field-informative 422 vs. `POST`'s bare, message-only 400).
- **Consequences:** Any future single-Client assignment UI in this product
  should default to `PATCH`, not `POST`, unless a fresh decision explicitly
  wants the ville/secteur-sync side effect back. Do not "simplify" this by
  switching to `POST` because it looks like the more obvious REST verb for
  a first-time assignment — the two are NOT interchangeable, and the
  divergence is deliberate, verified backend behavior, not an oversight.

## ADR-0036 — Client 360 Phase 3's `ClientGrattagePanel` is a fourth sanctioned Network←Grattage import, a distinct edge from Agent 360's own

- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** `next-session.md`'s own standing rule named exactly three
  sanctioned cross-domain Grattage imports and required "a fresh decision"
  before a fourth: Stock's `AgentTransferDetailPage` importing
  `useGrattageRestockGateQuery` (ADR-0027); Deposits' private,
  domain-local `fetchLinkedGrattageInvoices` read instead of a Grattage
  import (Option B, ADR-0030); and Network's `AgentOutstandingPanel`
  importing `useGrattageOutstandingQuery` from `domains/grattage/
  outstanding` (M7 Agent 360, ADR-0033). Client 360 Phase 3 needed a
  Client's own Grattage purchase history — a genuinely different backend
  contract (`GET /admin/grattage-invoices?client_id=...`) from Agent 360's
  own Outstanding read, and from a different Grattage submodule
  (`domains/grattage/invoices`, not `domains/grattage/outstanding`).
- **Decision:** `ClientGrattagePanel` (inside `network/clients`) imports
  `useClientGrattageInvoicesQuery`, the smallest sanctioned public export
  widened onto `domains/grattage/invoices`'s existing surface this phase —
  mechanism 1 (page-level composition, FTA §4), the same pattern
  `AgentOutstandingPanel` already established for its own, different
  Grattage submodule. This is the fourth sanctioned Network←Grattage edge,
  not a reuse of the third — `domains/grattage/invoices` and `domains/
  grattage/outstanding` are two separate submodules with two separate
  backend contracts, and neither Network caller imports the other's
  Grattage submodule.
- **Rationale:** Option B's private-duplicate-read pattern (Deposits' own
  precedent) was considered and rejected here for the same reason
  `AgentOutstandingPanel` rejected it: `domains/grattage/invoices` already
  has its own real query/model/mapper layer with real business meaning
  (invoice identity, status, historical Commercial) that a private
  duplicate read inside `network/clients` would either re-implement badly
  or drift from. Mechanism 1 (direct public-surface import) is the correct
  choice once a domain's own public surface already carries exactly the
  shape a caller needs, matching the FTA §4 mechanism-1/mechanism-2 split
  already in use elsewhere in this codebase.
- **Consequences:** The standing "do not add a second/third/fourth
  Grattage cross-domain import" rule in `next-session.md` is updated to
  name four sanctioned edges, not three. `eslint.config.js` still has no
  rule enforcing this boundary (the ESLint domain-boundary gap, carried
  forward again in `next-session.md`'s own follow-up list) — all four
  edges remain correct today by review discipline, not tooling. A fifth
  cross-domain Grattage need should still default to Option B unless a
  fresh decision says otherwise, per the original rule's own intent.

## ADR-0037 — M7 Overview Phase 1's `OverdueGrattageWidget` is a fifth sanctioned Grattage cross-domain import, and the first from a domain other than Network

- **Date:** 2026-08-15
- **Status:** Accepted
- **Context:** The standing rule (ADR-0036) named four sanctioned
  Stock←Grattage/Money↔Grattage/Network←Grattage imports and required a
  fresh decision before a fifth. Overview Phase 1 needed a queue of
  overdue Grattage invoices — the identical underlying read Grattage
  Invoices' own list page already exposes, and the exact same
  `useGrattageInvoicesQuery` `ClientGrattagePanel` already proved out as
  the general (non-Client-scoped) sibling of `useClientGrattageInvoicesQuery`.
  This is a NEW domain (`overview`, not `network`) reaching into Grattage
  for the first time.
- **Decision:** `OverdueGrattageWidget` (inside `domains/overview`) imports
  `useGrattageInvoicesQuery`, widened onto `domains/grattage/invoices`'s
  existing public surface this same session (alongside
  `GRATTAGE_INVOICE_LIST_DEFAULTS`/`GrattageInvoiceListParams`) — mechanism
  1 (page-level composition, FTA §4), the identical pattern every prior
  Grattage cross-domain edge already used. This is the fifth sanctioned
  edge, and the first one originating from Overview rather than Network or
  Stock.
- **Rationale:** Option B (a private, domain-local duplicate read) was
  rejected for the same reason it was rejected for `ClientGrattagePanel`
  (ADR-0036) and `AgentOutstandingPanel` (ADR-0033): Grattage Invoices'
  own public surface already carries exactly the shape this widget needs
  (list, status filter, real pagination total), with real business
  meaning (invoice identity, Commercial, Client, status) a private
  duplicate would either re-implement badly or drift from. No new
  query/model/mapper was written — `useGrattageInvoicesQuery` is the SAME
  general list query `GrattageInvoicesListPage` itself calls, merely
  exported for a second caller.
- **Consequences:** The standing "do not add another Grattage cross-domain
  import" rule in `next-session.md` is updated to name five sanctioned
  edges, not four. No new permission was introduced — the widget reuses
  `ACCESS_DASHBOARD`, the identical permission the read already carried
  before this widening. A sixth cross-domain Grattage need should still
  default to Option B's private-duplicate-read pattern unless a fresh
  decision says otherwise.

## ADR-0038 — Dashboard Statistics' `total_solde`/`total_cash` aggregate zero-fallback is normalized at the mapper boundary; never reconstructed through a JS number

- **Date:** 2026-08-16
- **Status:** Accepted
- **Context:** M7 Overview Phase 2 needed to render
  `GET /admin/dashboard/statistics`'s `agents_finance.total_solde`/
  `total_cash` — raw SQL `SUM()` aggregates over `Agent.solde`/`Agent.cash`
  (`decimal:2` columns), not per-row Eloquent-cast attributes. Verified
  LIVE against the running dev database, not assumed from PHP source
  alone (`php artisan tinker` invoking `DashboardController::index()`
  directly): Laravel's query-builder `sum()` never casts its raw driver
  return, and the pgsql PDO driver returns a non-empty numeric aggregate
  as a STRING (`"total_solde":"500.00"`, confirmed live). But `sum()`'s
  own implementation is `return $result ?: 0;` — a SQL `SUM()` over ZERO
  matching rows returns `NULL`, which is falsy, so the fallback yields a
  literal JSON INTEGER `0`, not `"0.00"` (confirmed live on a sibling
  `sum()` field on the same endpoint, `debt.total_paid`, on a table with
  no rows). This is a genuinely NEW value shape for this codebase: every
  prior "backend-computed decimal" convention (Cheques' `amount`,
  Grattage's `totalAmount`, Managers'/Commercials' `avanceTotal`) is
  ALWAYS a string, never sometimes-a-bare-number.
- **Decision:** `normalizeAggregateDecimal` (`dashboard-statistics-api.ts`)
  corrects ONLY this wire-representation gap, at the mapper boundary,
  before the value ever reaches a component: a string is returned
  UNTOUCHED, verbatim; a numeric `0` becomes `"0.00"`; any OTHER non-zero
  number THROWS rather than being silently formatted. `StatCard` then
  renders the resulting string verbatim (`tabular-nums` only) — never
  through `MoneyAmount`/`formatMoney`, which take a genuine `number` and
  would round-trip a backend-computed decimal through JS floating point,
  exactly the corruption class this domain's own existing convention
  already forbids for `avanceTotal`/`solde`/Grattage's `totalAmount`.
- **Rationale:** The two real values (a non-empty sum, and a sum over zero
  rows) are the SAME fact — "no money" — expressed by the backend in two
  different wire shapes purely as an artifact of `sum()`'s own `?: 0`
  fallback, not two different business meanings. Normalizing the
  representation gap is not "financial arithmetic" (no parsing, no
  rounding, no reconstruction) — it is fixing an accidental serialization
  inconsistency so both shapes mean the same rendered string. Throwing on
  any OTHER non-zero number is the deliberate, narrow boundary: only the
  one verified case (`0`) is normalized; an unverified future wire change
  fails loud (surfacing as the Statistics panel's own retryable error
  state) rather than silently inventing a formatting rule for a value
  this decision never confirmed could occur. This mirrors the same
  restraint ADR-0032/ADR-0033 already established for Allocation's
  capacity gate and Available Grattage: never re-derive a backend-owned
  financial number client-side, and never guess at a shape the backend
  hasn't verified it sends.
- **Consequences:** `DashboardStatistics.exposure.totalSolde`/`totalCash`
  are typed as plain `string` in the UI model (the wire type is
  `string | number`, narrowed to `string` by the mapper) — any future
  caller reads a single, consistent type, never a union. Any future Phase
  3 chart series carrying the same `SUM(amount)` shape
  (`chart-data.deposits_over_time.total_amount`) should default to
  reusing this identical discipline, RE-VERIFIED LIVE for that specific
  field rather than assumed safe by resemblance (ADR-0022's own standing
  rule). No `invalidation-map.ts` entry was added for this read — no
  mutation in the product writes these aggregated fields in a way that
  needs instant reaction; the `SLOW` (5 min) stale tier is the approved,
  sufficient freshness guarantee.
