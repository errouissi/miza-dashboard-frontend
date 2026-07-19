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
