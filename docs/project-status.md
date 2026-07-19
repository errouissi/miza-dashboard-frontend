# Project Status

**The current state of the project.** Overwrite this file after every completed
milestone — it describes *now*, not history. History lives in `decisions.md` and git.

_Last updated: 2026-07-19_

---

## Current milestone

**M3 — Network / identity graph.** M3.1 (Admins) and **M3.2 (Managers) complete**;
**M3.3 (Commercials) is next.**

## Current branch

`main` at `05a514a` — **level with `origin/main`**. The entire M3.2 implementation is
**uncommitted** in the working tree, along with the documentation reconciliation that
preceded it. Nothing has been committed or pushed this session.

## Last completed implementation

**M3.2 — Managers.** The second Network domain, the **first genuinely paginated
resource since Villes**, and the **first domain route gated on something other than
`access-dashboard`** (`view-agents`).

Delivered against the verified `AgentController::indexManagers` contract: server
pagination, search, five filters, edit, block/activate, permission gating, and loading /
empty / error states. **No sorting** (BC-L), **no detail page** (ADR-0014), **no create
form** (M3.6) — each an absence the API or the roadmap requires, not an omission.

⚠️ **The Block action is correct but currently uninvokable** — the backend never creates
the `block-agent` permission it gates on (**BC-T**, below). Activate is unaffected.

Four backend traps were handled explicitly rather than papered over:

| Trap | Handling |
| --- | --- |
| `avance_total` is a **preformatted `bcadd` string**, not a number | Carried and rendered **verbatim**. Never parsed — no shared money abstraction |
| A **fifth distinct envelope**: `{success, data: <flat paginator>}`, rows at `data.data` | Mapped in the domain's own anti-corruption layer. `fromLaravelPage` deliberately **not** bent to fit (it reads `envelope.meta`, absent here) |
| Search is **case-sensitive** (BC-O) | Stated in the placeholder. The term is **not** lower-cased client-side, which would hide the defect |
| `date_to` **excludes its own day** (BC-P) | Field labelled "Joined before". No client-side day arithmetic |

The `ville` filter is a **select**, not a text box: the backend filters it on exact
equality, so free text would be a control that appears to work and does not (ADR-0009).
It lives in its own component so the Villes options query mounts only for operators
holding `access-dashboard`, which is what guards that endpoint.

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
| **M3.2 — Managers** | ✅ **complete (uncommitted)** |
| M3.3 — Commercials | ⬜ next |
| M3.4 — Clients | ⬜ pending |
| M3.5 — Client bulk-assign | ⬜ pending |
| M3.6 — Agent onboarding wizard | ⬜ pending |
| M3.x — Admin + Manager detail pages (ADR-0014) | ⬜ pending — **blocked by FE-2** |
| M4+ — Money, Stock, Grattage, Overview | ⬜ not started |

**Tests: 279/279 across 21 files** (was 238/20 — M3.2 adds 39 domain tests and 2
route-authorization cases). Lint · typecheck · format · build all clean.

## Shared pattern layer

Six components, **unmodified since extraction** — have now absorbed a **fifth** resource
(Managers) with zero changes, including the first paginated + status-enum + money one:

- `ConfirmActionDialog` · `ListPage` · `FormDrawer`
- `ListLoadingState` · `ListErrorState` · `ListEmptyState`

**Deliberately not extracted** (evidence still insufficient — `decisions.md` ADR-0006):
`DataTable` · `FilterBar` · `StatusBadge` · `MoneyAmount` · `EntityChip` ·
Resource-definition module · URL-filter hook

Managers moves two of these to **evidence #1 of the required three**, no further:

- **`StatusBadge`** — Managers carries the product's first real three-value status enum.
  Admins' `is_active` is a boolean in a different vocabulary and does not generalise.
- **`DataTable` / URL-filter hook** — Managers is only the **second** paginated resource
  (with Villes), and BC-G keeps Secteurs/Products/Admins unpaginated, so a third
  genuinely comparable case cannot exist until the backend paginates them.

## Current blockers

| ID | Blocker | Blocks |
| --- | --- | --- |
| **BC-T** | 🔴 **`block-agent` permission is never created**, so the shipped Block action is uninvokable by anyone — see below | The Managers **Block** action, in production. Backend-side one-line fix |
| **FE-1** | Test-suite flake, **severity raised by M3.2** — see below | Recommended **before M3.3** |
| **FE-2** | `withPermissionGuards` is shallow — a nested route's own `handle.permission` is silently ignored | The **deferred detail-page milestone** (ADR-0014). Did not block M3.2 — no nested route shipped in it |
| **BC-G** | Secteurs/Products/Admins index endpoints unpaginated | `DataTable`/`FilterBar` extraction |

### BC-T — the Block action ships dead, and the frontend is not at fault

Found by live verification during the M3.2 commit-readiness pass, against the running
backend at `http://127.0.0.1:8000`.

`PUT /admin/agents/{id}/block` is gated on `permission:block-agent`
(`routes/api.php:220`), but **`block-agent` is never created**.
`RolePermissionSeeder.php:43-48` creates `create-agent`, `update-agent`,
`delete-agent`, `view-agents`, `activate-agent` and `manage-agent-status` — and stops.

Evidence, all from one session against one super-admin token:

| Probe | Result |
| --- | --- |
| `POST /auth/login` as `superadmin@test.com` | 40+ permissions returned; **`block-agent` absent** |
| `PUT /admin/agents/1/block` | **403** `Spatie\Permission\Exceptions\UnauthorizedException` |
| `PUT /admin/agents/1/activate` | **Passed the gate**, reached the controller (500 — agent 1 does not exist) |

The paired block/activate calls are what isolate it: identical token, identical request
shape, one refused at the permission layer and one not. The permission is unholdable, so
**no user — not even a super admin — can block an agent**, and `has('block-agent')` is
false for everyone, meaning the Block button never renders in production.

**The frontend is correct and must not be changed.** It mirrors the server's actual route
gating exactly, which is the rule. Re-gating Block onto `manage-agent-status` or
`delete-agent` would offer a control the server refuses — the precise failure mode the
working agreement forbids. The fix is one line in the backend seeder; when it lands, the
button starts working with **no frontend change at all**.

The M3.2 Block implementation is therefore **complete and committed deliberately in a
dead state**. This is recorded so nobody later "fixes" the frontend for it.

### FE-1 — severity raised, now the top follow-up

Error-state assertions in five older test files call `findByRole("alert")` on the **1000
ms default timeout** while the assertions themselves run **951–1240 ms**. Measured this
session:

- **In isolation the suite is green** — 3 consecutive clean runs of 279/279, plus one
  run showing the historical ~1-in-N single failure (`villes-list-page`).
- **Under CPU contention it collapses**: a run started while `pnpm build` was still
  finishing produced **22 failures across 8 files**, every one an error-state assertion.

M3.2's larger suite makes contention likelier, so this will bite CI before it bites a
developer. **The fix is known and mechanical** — an explicit `{timeout: 3000}` on the
~14 assertions listed in `next-session.md`. The M3.2 tests already carry it; the five
older files do not.

It was **deliberately not applied this session**: it spans five other domains' test files
and so falls outside M3.2's scope, and `next-session.md` forbids modifying existing tests
without raising it first. This is the raising.

**Governance follow-ups — not blockers** (they gate a formal sign-off, not any code):

| ID | Item | Gates |
| --- | --- | --- |
| G2-A/E/F | Gate G2 wording amendments not yet adopted | Formal G2 closure |
| G2-R7 | Fourth-resource estimate needs team agreement | Formal G2 closure |

G2's evidence criteria (R1–R6) all **pass**; only wording adoption and the R7 estimate
remain.

## M3 detail pages — deferred by ADR-0014

`phase8-architecture.html:650` names Managers explicitly in *"Admins, Managers,
Commercials, Clients — full ListPage + DetailPage + forms"*, and the roadmap's M3
deliverables (`:476`) agree. The backend supports it (`GET /admin/agents/{identifier}`).

**ADR-0014 records the deferral:** M3 ships list management first, and Admin and Manager
detail pages move to a dedicated later M3 milestone. They are owed work, not cancelled.
M3.2 shipped list-only accordingly and contributes **no nested route**, so FE-2 remained
non-blocking — but it must be fixed before the first nested route is introduced.

## Backend dependencies

Each row is classified: **defect** (backend behaves wrongly) · **limitation** (backend
cannot express something) · **cleanup** (works, but wasteful) · **verified** (correct,
merely surprising — documented so nobody "fixes" it).

From the M3.2 contract verification, all against `AgentController::indexManagers` unless
noted. **All five survived implementation unchanged** — none required a workaround, and
none blocked delivery:

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-N | **defect** | `$request->validate()` sits inside the `try` whose `catch (\Exception)` swallows `ValidationException` → invalid filters return **500**, not the standard 422 `{message, errors}`. `grattageOutstanding()` hoists `validate()` out of the try to avoid exactly this; `store()` catches `ValidationException` first. This method does neither | 🔴 open — **unreachable through the UI**: every control is bounded, and `readParams` re-validates the query string so a hostile URL is rejected client-side. Two tests pin this |
| BC-O | **defect** | Search uses `LIKE` on PostgreSQL, so it is **case-sensitive** — `casa` does not match `Casablanca`. The Villes contract is explicitly case-insensitive. One-line fix: `ILIKE` | 🟡 open — **surfaced in the UI copy**, not hidden. Fixing it backend-side needs no frontend change |
| BC-P | **defect** | `date_to` compares a datetime column against midnight (`where('date_ajout','<=',…)`), so it **excludes its own day**. `getAgentSubData()` uses `whereDate()` for the same job. One-line fix | 🟡 open — field labelled "Joined before". **Fixing it backend-side requires relabelling the field** |
| BC-Q | **cleanup** | `with(['commercials'])` eager-loads the full collection on every page, and the transform discards it — only `withCount` is used. Dead N-row load | 🟢 backend-side only; no frontend impact. A test pins that no commercials array is read |
| BC-R | **verified** | `DELETE /agents/{id}` does **not** delete — `destroy()` sets `status='blocked'`, identical to `block`. Two permission gates, one behaviour. Update is `POST /agents/{id}`, not `PUT` | 🟢 correct as built. **No delete action is offered anywhere in the domain**, and `delete-agent` is deliberately unregistered |

Carried from earlier milestones:

| ID | Item | Status |
| --- | --- | --- |
| BC-M | Permission catalogue endpoint | ✅ **resolved by B-6** |
| BC-A | No seeded account lacking `access-dashboard` | 🔴 open — blocks 403-path QA |
| BC-D | Blank permission row still created by `AdminUserSeeder:37` | 🟡 open — catalogue filters it server-side; UI unaffected |
| BC-G | Secteurs/Products/Admins unpaginated | 🔴 open — blocks M2c-deferred extraction |
| BC-H | No bounded endpoint for relation pickers (`per_page` max 100) | 🟡 open — **now live**: the Managers city filter reads villes bounded at 100. Bites harder in M3.3 |
| BC-B / BC-I | Deletes have no in-use guard → 500 instead of domain 409 | 🟡 open — per capability |
| BC-L | Agent/Client lists accept no `sort` param | 🟡 open — **M3.2 ships without sortable headers** because of it |
| BC-C | No granular reference-data permissions | 🟢 non-blocking |
| BC-E | `exposed_headers` must include `X-Request-Id` when B-4 lands | 🟢 non-blocking |
| BC-F | Contradictory docs on villes 403 envelope | 🟢 docs only |
| BC-J / BC-K | `Product.value` semantics; missing composite unique index | 🟢 non-blocking |
| — | `view-permissions` permission (B-6 deferred the OR-gate cleanup) | 🟢 non-blocking |

**New, registered by M3.2 implementation:**

| ID | Class | Item | Status |
| --- | --- | --- | --- |
| BC-S | **limitation** | `agents.ville` is a free-text **column**, not a foreign key to `villes`. The city filter is a select over the reference set, but a manager whose ville was typed differently from that list **cannot be selected**. The honest fix is a backend distinct-values endpoint | 🟡 open — documented in `manager-ville-filter.tsx` rather than worked around. **Do not invent the endpoint** |
| BC-T | **defect** | `PUT /agents/{id}/block` is gated on `permission:block-agent` (`routes/api.php:220`), but `RolePermissionSeeder.php:43-48` **never creates that permission**. Verified live: super-admin 403s on block and passes on activate. One-line seeder fix | 🔴 open — **the shipped Block action is uninvokable by anyone**. Frontend is correct and must not compensate. See the dedicated section above |

## Domain inventory

```
src/domains/
├── auth/                  M1-C
├── reference/
│   ├── villes/            M1   (paginated · search · sort)
│   ├── secteurs/          M2a  (unpaginated · 1 relation filter)
│   └── products/          M2b  (unpaginated · 1 enum filter · money)
└── network/
    ├── admins/            M3.1 (unpaginated · granular permissions · picker)
    └── managers/          M3.2 (paginated · search · 5 filters · status enum ·
                                 backend-formatted money · NO sort, NO create,
                                 NO detail page)
```
