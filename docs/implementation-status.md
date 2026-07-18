# Implementation Status

Single source of truth for *where we are*. Keep it short.

**Current milestone: M1 — Walking skeleton** · status: **M1-A, M1-B, M1-C complete; Villes (the last
documented M1 deliverable) in progress**

M1-A/B/C are this repository's working sub-division of the roadmap's **M1 — Walking skeleton**. The
frozen roadmap defines milestones at M0/M1/M2 granularity only; the sub-letters exist here and in code
comments, and nowhere else. There is no "M1-D": what remains of M1 is **Villes end to end**, which
carries the permission registry entries, the generated route guards, and the first query-key factory
with it.

## Remaining M1 work (roadmap §M1 deliverables)

| Deliverable | Status |
| --- | --- |
| HTTP client + interceptors + AppError normalization | ✅ M1-A |
| 401 session policy, incl. concurrent-401 collapse | ✅ M1-A |
| Query client + staleness tiers | ✅ M1-A |
| Query-key factory for one resource | 🔨 with Villes |
| Session store + permission registry + evaluator | ⚠️ store/evaluator ✅ M1-A; **registry populated with Villes** |
| Route-guard generation from declared permissions | 🔨 with Villes |
| AppShell, sidebar rendering from the registry | ✅ M1-B |
| Formatters — money, date, phone, identifier | ✅ M1-A |
| Login / logout / session lifecycle | ✅ M1-C |
| **Villes: list, filter-in-URL, create/edit drawer, delete confirmation** | 🔨 in progress |

The registry, the guard generator and the key factory were deliberately deferred until a real domain
resource existed to shape them (FTA D-11) — Villes is that resource, so they land now and not before.

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

**Finish M1 — Villes end to end**, then Gate G1.

Gate **G1** asks one question: did the architecture survive contact with the real backend?
PR-1 answered it for errors, auth and correlation. Villes answers it for pagination and permissions.

### Open against M1's exit criteria

Roadmap M1 requires: *"A user without the permission sees no nav item, no button, and the calm 403
on direct URL entry."* Villes cannot fully demonstrate this — every villes action is gated behind the
single coarse `permission:access-dashboard` (`routes/api.php:160-161`,
`VilleController::middleware()`), so "a user without the permission" is a user who cannot open the
dashboard at all. The *mechanism* (registry → nav filter → route guard → 403) is built and tested;
the granular case it exists for is unproven until a resource with per-action permissions lands
(Agents, M3). Granular ville permissions are recorded as backend consultation, not assumed.
