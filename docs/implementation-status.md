# Implementation Status

## Purpose

**The historical implementation record.** This file captures how each milestone was
delivered — the deliverable checklists, the gate evaluations, the contradictions
implementation found in the frozen documents and how they were reconciled. It is the
narrative of *how we got here*, and it is worth reading when you need the reasoning
behind a milestone's shape.

It is **not** the place to look for current state. For that:

| Question | File |
| --- | --- |
| Where is the project *now*? | [`project-status.md`](project-status.md) |
| Why was something built this way? | [`decisions.md`](decisions.md) |
| What do I do next session? | [`next-session.md`](next-session.md) |

Sections below reflect the state at the time each milestone closed. They are not
updated as the project moves on — later milestones append their own record.

---

**M1 — Walking skeleton** · status: **COMPLETE** · **Gate G1: PASSED with reconciliation**
**Current: M2 — Pattern hardening** · status: **M2a READY to start** · M2c and Gate G2 gated on BC-G
(see "M2 readiness — by capability")

M1-A/B/C are this repository's working sub-division of the roadmap's **M1 — Walking skeleton**. The
frozen roadmap defines milestones at M0/M1/M2 granularity only; the sub-letters exist here and in code
comments, and nowhere else. There was never an "M1-D": the remainder of M1 was **Villes end to end**,
which carried the permission registry entries, the generated route guards, and the first query-key
factory with it.

## M1 deliverables (roadmap §M1) — all complete

| Deliverable | Status |
| --- | --- |
| HTTP client + interceptors + AppError normalization | ✅ M1-A |
| 401 session policy, incl. concurrent-401 collapse | ✅ M1-A |
| Query client + staleness tiers | ✅ M1-A |
| Query-key factory for one resource | ✅ `villesKeys` |
| Session store + permission registry + evaluator | ✅ registry populated with Villes |
| Route-guard generation from declared permissions | ✅ generated from `handle.permission`, fails closed |
| AppShell, sidebar rendering from the registry | ✅ M1-B |
| Formatters — money, date, phone, identifier | ✅ M1-A |
| Login / logout / session lifecycle | ✅ M1-C |
| Villes: list, filter-in-URL, create/edit drawer, delete confirmation | ✅ |

The registry, the guard generator and the key factory were deliberately deferred until a real domain
resource existed to shape them (FTA D-11) — Villes was that resource.

## M1 exit criteria (roadmap §M1 "Exit criteria")

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| A permitted user creates a real ville against the real backend, through the full stack | ✅ | Manual QA — create/update/delete verified against the local backend |
| A user without the permission sees no nav item, no button, and the calm 403 on direct URL entry | ⚠️ **partial — backend-blocked** | Mechanism complete and covered by automated tests. **No seeded account lacks `access-dashboard`**, so it is unverified against a real unpermitted session. See BC-A. Not a frontend failure |
| A filtered list URL, pasted into a second browser, reproduces the same view | ✅ | Automated (URL read/write, hostile-param rejection) + manual QA |
| An expired token mid-session produces one clean redirect to login, return path preserved, verified with concurrent requests in flight | ✅ | Automated — `session-redirect.test.tsx` incl. the 5-concurrent-401 collapse |
| A forced 500 renders the error state **with a support reference**; a forced 422 maps to its field | ✅ **closed** | 422→field ✅ (duplicate-name test). 500 → retryable error state **now rendering the correlation reference**, derived from the shared `resolveErrorDisplay()` — the same identifier `RouteErrorBoundary` shows. Tests assert it equals the `X-Request-Id` actually sent, that no empty placeholder renders, and that manual retry still recovers |

## Gate G1 — "Did the architecture survive contact with the real backend?"

**Passed.** Auth, pagination envelope, error shape and permission strings all survived; where reality
contradicted the documents, the documents were corrected rather than the code bent — which is what G1
exists to force ("Fix the document, then continue. Do not paper over it in code").

Reconciled contradictions found by running against the real backend:

- **Permission strings** — the assumed granular per-resource strings do not exist. Villes/Secteurs/
  Products are all gated behind one coarse `access-dashboard`. Recorded here and in BC-C; the registry
  mirrors the server truthfully rather than inventing names.
- **Envelope divergence** — Villes' four write endpoints return four different shapes. Absorbed by the
  resource's own mapper (FTA D-6) exactly as designed; recorded in BC (contract consistency).
- **Error shape** — the documented 403 renderer coverage for villes is contradicted by the backend's
  own docblock. No frontend impact (normalizer handles both); recorded in BC.
- **Seed data defect** — an account is seeded with an empty-string permission, which made the route
  guard's original `permission ?? ""` shape a genuine fail-open. Guard now refuses unconditionally,
  with a regression test. Recorded in BC.

## Manual QA — passed

Verified against the local backend (PostgreSQL `miza`, `php artisan serve`, Vite dev): login, logout,
create Ville, update Ville, delete Ville. Automated suite: **136/136 across 17 files**; lint,
typecheck, format and build clean.

## M2 readiness — by capability

M2 ships **Secteurs → Products → extract the shared patterns from the three working screens**. Both
`SecteurController::index` and `ProductController::index` return `response()->json($query->get())` —
an unpaginated raw array with no `search`, `sort` or `direction` (BC-G). That constrains **what the
screens can honestly do**, and therefore what M2c may extract — but it does **not** stop the screens
from being built.

| Capability | Status | Reasoning |
| --- | --- | --- |
| **M2a — Secteurs** | ✅ **READY** | Full CRUD exists (`apiResource`, `SecteurController`). Build to the *current* contract: list from the raw array, `ville_id` filter in the URL, create/edit drawer, delete confirmation, composite-unique 422 mapping. **No pagination, search or sort controls** — the endpoint offers none, and rendering dead controls would be a lie about the API |
| **M2b — Products** | ✅ **READY** | Same shape; adds an `operator` enum (`IAM\|INWI\|ORANGE`) and integer `value`. Same current-contract constraints |
| **M2c — Extraction** | ⛔ **BLOCKED (BC-G)** | The patterns to extract are `DataTable`/`FilterBar`/`ListPage` — pagination, search and sort abstractions. With one paginated resource and two unpaginated ones, the rule of three has one real case, not three. Extracting here fits the pattern to a backend inconsistency |
| **Gate G2** | ⛔ **NOT YET PASSABLE** | Its exit criteria require Products to ship *"with no new pattern code"* and Villes/Secteurs to refactor onto the extracted pattern *"with no behavior change"*. Neither is satisfiable while the three resources expose different list capabilities |

**G2 becomes passable when** either (a) BC-G lands and Secteurs/Products expose the Villes list
contract, so the three screens are genuinely comparable; or (b) the roadmap explicitly accepts
heterogeneous list capabilities and M2c's scope is renegotiated in writing to extract only what all
three share. Option (b) is a documented decision, not a default.

## M1-C — Authentication (complete)

| Item | Status |
| --- | --- |
| `POST /auth/login` via a domain `api/` module, sending `app: "admin"` (never `"dashboard"`) | ✅ |
| Login page: RHF + zod, invalid-credentials and blocked-account handled distinctly | ✅ |
| Session established through `sessionManager.start()` — no duplicated session state | ✅ |
| Logout: backend revocation first, `terminate()` on settle (success **or** failure) | ✅ |
| Navigation after logout stays with `wireSessionTermination` — one navigation authority | ✅ |
| Validated `?next=` return path preserved, read in the app router layer | ✅ |
| Session restoration remains lazy/optimistic — no boot-time `/me` call (approved) | ✅ |
| Temporary English copy pending O-1 | ✅ |

Approved and deliberately **not** built: boot-time `/me` validation, cross-tab session sync
(`storage`/`BroadcastChannel`), any refresh-token flow. The `useSyncExternalStore` session mechanism
is ratified as the official architecture; no ADR required at this stage.

## M1-B — Application shell (complete)

| Item | Status |
| --- | --- |
| AppShell: sidebar + header + outlet, content-region-only scroll | ✅ |
| Data router (`createBrowserRouter`) so a 401 can navigate from outside React | ✅ |
| `ProtectedShell` — every route below `/` is structurally guarded | ✅ |
| Safe return-path handling (`?next=`), open-redirect proof | ✅ |
| Route error boundary on a pathless child route — a crashed page keeps the shell usable | ✅ |
| Nav model as data (`NAV_TREE` + `filterNav`), permission-filtered | ✅ |

## M1-A — PR-1 items

| Item | Status |
| --- | --- |
| HTTP client (the only `axios`), request/response pipeline | ✅ |
| `AppError` hierarchy + **envelope-based** normalization (Decision 1) | ✅ |
| Correlation ID: generated, sent, preserved on `AppError` (frontend-only — see B-4) | ✅ |
| Error-code registry — *mechanism + fallback*; entries deferred to O-1 | ✅ |
| TanStack Query: `QueryClient`, staleness tiers, retry policy (mutations never retry) | ✅ |
| Session store (sole `localStorage` owner) + manager, **idempotent single-flight terminate** | ✅ |
| 401 policy: central teardown, concurrent-401 collapse | ✅ |
| Permission registry + pure resolver (strings, never roles) | ✅ |
| `useSession` / `usePermission` via `useSyncExternalStore` (Decision 2 — no Provider) | ✅ |
| Route guards: `RequireAuth`, `RequirePermission` | ✅ |
| Formatters: money, date, phone, identifier (Design System §5/§27) | ✅ |
| 70 tests passing; lint/typecheck/build/format green | ✅ |

Deliberately **not** built (no caller yet — FTA D-11): invalidation map, `Paginated<T>`, logger/observability,
relative-date + percentage formatters (French copy → O-1).

## M0 — bootstrap items

| Item | Status |
| --- | --- |
| Scaffold seeded from `C:\Miza\frontend` (tooling only, no legacy architecture) | ✅ |
| Layered structure: `app / domains / shared / infrastructure / test` | ✅ |
| TanStack Query + TanStack Table added (the only FTA-approved additions) | ✅ |
| Boundary lint enforcing `app → domains → shared → infrastructure` | ✅ |
| Deep-import ban (resources importable only via their public index) | ✅ |
| `axios` confined to `infrastructure/http` | ✅ |
| Validated config entry point + fail-fast bootstrap | ✅ |
| Four environments (development / test / staging / production) | ✅ |
| Test harness: Vitest + jsdom + Testing Library + MSW | ✅ |
| Infrastructure smoke tests (8 passing) | ✅ |
| CI: install → lint → typecheck → test → build | ✅ |
| Scripts: dev, build, preview, lint, typecheck, test, test:ci, format, format:check | ✅ |
| **O-1 interface language sign-off** | ⛔ external |
| **Backend tickets raised & accepted** | ⛔ external |

## Blockers — external, not resolvable in this repo

Recorded per Roadmap §7. None of these block the *bootstrap*, but M0's gate (G0) does not pass
until the first two are answered, and no product copy may be written before O-1 is decided.

| # | Blocker | Owner | Blocks |
| --- | --- | --- | --- |
| O-1 | **Interface language** (French-first assumed throughout the Design System, §27). Unconfirmed. | Product | All UI copy. Every label written before this is settled is rework. |
| B-1 | **Companies & Suppliers controllers do not exist** (Discovery §6). | Backend | Stock directory screens (M5). The four stock movement types are *not* blocked; the UI ships dark behind a flag. |
| B-2 | **Overview endpoints unrouted** — `chartData`, `recentActivities`, `agentsOverview`. | Backend | Part of the Overview widget grid (M7). Ships with the widgets whose endpoints exist. |
| B-3 | **Domain error-code catalogue unconfirmed.** Needed to populate the error-code registry (FTA D-10). | Backend | Complete error handling; partially fillable per-domain as codes are documented. *(Codes are now known to exist and are enumerable from `app/Exceptions/**` + `app/Http/Exceptions/*Renderer.php` — what is missing is confirmation of the catalogue, not its existence.)* |
| B-4 | **No request-correlation support.** The backend has no middleware that emits or logs a request ID. The frontend now generates and sends `X-Request-Id` and preserves it on `AppError` — but until the backend **logs** it, correlation is a frontend-only trace and cannot be joined to a backend log line. Frontend already consumes a backend-supplied ID if one appears, so this needs no frontend change when it lands. | Backend | Real end-to-end debugging (FTA §11, §18). Not blocking. |
| ~~B-5~~ | ~~**`VilleController` returns `Ville::all()`**~~ — **RESOLVED (backend, pending review/commit).** `GET /api/v1/admin/villes` now returns the standard paginated envelope. See the contract below. | Backend | ~~Blocks M1-B~~ — **unblocked.** |

## The Villes list contract (B-5, resolved) — what M1-B builds against

```
GET /api/v1/admin/villes?page=1&per_page=15&search=casa&sort=nom_ville&direction=asc

page       integer, min 1                  default 1
per_page   integer, min 1, MAX 100         default 15
search     string, max 255 — nom_ville, CASE-INSENSITIVE ("CASA" -> "Casablanca")
sort       nom_ville | id                  default nom_ville
direction  asc | desc                      default asc

200 -> { data: [ { id, nom_ville } ], links: {...}, meta: { current_page, per_page,
         total, last_page, ... } }          <-- this is the shape Paginated<T> normalizes
422 -> { message, errors: { per_page: [...] } }   <-- normalizer kind: "validation"
403 -> Laravel default 403, NO `code` field       <-- normalizer kind: "permission"
       (AuthorizationExceptionRenderer is path-gated to the four Phase-4A stock domains;
        villes is not in its scope. The envelope-based normalizer handles this correctly
        via its status fallback — no frontend change needed.)
```

Default order is `nom_ville ASC`, not `created_at DESC`: the `villes` table has **no timestamp
columns at all**, so `created_at` is not a sortable field here. Do not assume the other admin
lists' default ordering applies.

**Envelope divergence to expect:** Villes/Bons use `{data, links, meta}`; Clients/Agents use
`{success, data: <paginator>}`. Both normalize to one `Paginated<T>` via each resource's own
mapper (FTA D-6) — this is what the anti-corruption layer is for. Not a blocker.

## Not yet built (deliberately)

No business domain beyond Reference/Villes. `domains/auth` (M1-C) and `domains/reference/villes`
are the only domain folders. No shared `DataTable`/`ListPage`/`FormDrawer` patterns — those are
extracted in **M2**, from three working screens, not invented from one (FTA §12, roadmap M2).

## Next approved task

**M2 — Pattern hardening: the rule of three, executed** (roadmap §M2). M2a Secteurs → M2b Products →
M2c extract `DataTable` / `FilterBar` / `ListPage` / `FormDrawer` + the resource-definition module,
then refactor Villes and Secteurs onto them.

**M2a may start now**, built to the current Secteurs contract. M2c and G2 wait on BC-G.

## Open frontend items carried into M2

- ~~Correlation reference missing from inline query-error states.~~ **RESOLVED.** The Villes list
  error state renders the reference from the shared `resolveErrorDisplay()`, omitting the line
  entirely when no reference exists. Copy this into Secteurs/Products rather than extracting a shared
  error component — extraction is M2c's job, from three screens.
- **Guard generation is shallow.** `withPermissionGuards` wraps only the routes passed to it. No
  resource contributes `children` yet (FTA D-11); the first nested route must extend it, or a child's
  own `handle.permission` will be silently ignored in favour of its parent's.
- **Ville picker capacity.** The Secteurs form needs every ville as an option, but the villes list is
  paginated at `per_page ≤ 100`. Fine while the dataset is under 100; not a general solution. See BC-H.

## Open backend consultation items

Raised, not assumed. None was worked around in code.

| Ref | Item | Blocks |
| --- | --- | --- |
| BC-A | No seeded account lacks `access-dashboard` | M1 exit criterion 2; QA of the 403 path |
| BC-B | Deleting a ville in use returns 500, not a domain 409 | One capability; frontend message stays hedged |
| BC-C | No granular ville/secteur/product permissions | Nothing today; granular authz unproven until M3 |
| BC-D | `AdminUserSeeder` grants an empty-string permission | Mitigated frontend-side; seed defect remains |
| BC-E | `exposed_headers: []` will hide `X-Request-Id` when B-4 lands | Future correlation only |
| BC-F | Contradictory docs on the villes 403 envelope | Documentation only |
| BC-G | **Secteurs + Products `index` are unpaginated raw arrays** | **M2c extraction + Gate G2. Does NOT block M2a/M2b** |
| BC-H | No bounded "all villes" endpoint for relation pickers | Ville picker completeness beyond 100 villes |
| BC-I | `secteurs`/`products` delete has no in-use guard (same class as BC-B) | One capability per resource |
