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
