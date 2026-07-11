# Implementation Status

Single source of truth for *where we are*. Keep it short.

**Current milestone: M1-A — Infrastructure Foundation (PR-1)** · status: **code complete, awaiting review**

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
| **B-5** | **`VilleController` returns `Ville::all()`** — no pagination, no `data`/`meta` envelope, no filters. Every other admin controller paginates (`per_page` max 100). | Backend / Product | **Blocks the M1-B walking skeleton as specified** (Roadmap M1: "list → filter"). Either paginate Villes, or choose a different M1-B resource. Must be resolved before M1-B starts. |

## Not yet built (deliberately)

No business feature exists. No Villes. No domain folders. No pages, layout, sidebar or login.
`src/domains/` is still empty by design.

## Next approved task

**M1-B — Walking skeleton (PR-2).** Login → AppShell (sidebar/header/outlet) → router with
generated guards → **Villes** end to end against the real backend, with URL filter state.

**Blocked on B-5** (Villes has no pagination or filters) — resolve before starting, or the
skeleton cannot deliver "list → filter" as the roadmap specifies.

Also feeds M1-B: login must send the `app` input the backend expects (`check.app:admin`), and
the session is established via `sessionManager.start()` — the login *call* belongs to a domain
api/ module, not to `infrastructure/auth`.

Gate **G1** asks one question: did the architecture survive contact with the real backend?
PR-1 answered it for errors, auth and correlation. PR-2 answers it for pagination and permissions.
