# Project Status

**The current state of the project.** Overwrite this file after every completed
milestone — it describes *now*, not history. History lives in `decisions.md` and git.

_Last updated: 2026-07-19_

---

## Current milestone

**M3 — Network / identity graph.** M3.1 (Admins) complete; **M3.2 (Managers) is next.**

## Current branch

`main` — working tree clean, **not yet pushed** to origin.

## Last completed implementation

**Admin permission selector** — consumes the B-6 permission catalogue endpoint as the
sole source of truth. Domain-owned picker, no shared abstraction introduced.
Contract verified against the live endpoint before implementation.

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
| M3.2 — Managers | ⬜ next |
| M3.3 — Commercials | ⬜ pending |
| M3.4 — Clients | ⬜ pending |
| M3.5 — Client bulk-assign | ⬜ pending |
| M3.6 — Agent onboarding wizard | ⬜ pending |
| M4+ — Money, Stock, Grattage, Overview | ⬜ not started |

**Tests: 238/238 across 20 files.** Lint · typecheck · format · build all clean.

## Shared pattern layer

Six components, **unmodified since extraction** — absorbed a fourth resource (Admins)
with zero changes:

- `ConfirmActionDialog` · `ListPage` · `FormDrawer`
- `ListLoadingState` · `ListErrorState` · `ListEmptyState`

**Deliberately not extracted** (evidence insufficient — see `decisions.md` ADR-0005):
`DataTable` · `FilterBar` · `StatusBadge` · `MoneyAmount` · `EntityChip` ·
Resource-definition module · URL-filter hook

## Current blockers

| ID | Blocker | Blocks |
| --- | --- | --- |
| **G2-A/E/F** | Gate G2 wording amendments not yet adopted | Formal G2 closure |
| **G2-R7** | Fourth-resource estimate needs team agreement | Formal G2 closure |
| **FE-2** | `withPermissionGuards` is shallow — a nested route's own `handle.permission` is silently ignored | **Fix before M3.2 if detail pages ship** |
| **FE-1** | Test-suite flake (~1-in-19): error-state assertions run 951–1049 ms against a 1000 ms default `findBy` timeout | Recommended before M3.2 |
| **BC-G** | Secteurs/Products/Admins index endpoints unpaginated | `DataTable`/`FilterBar` extraction |

G2's evidence criteria (R1–R6) all **pass**; only wording adoption and the R7 estimate
remain.

## Backend dependencies

| ID | Item | Status |
| --- | --- | --- |
| BC-M | Permission catalogue endpoint | ✅ **resolved by B-6** |
| BC-A | No seeded account lacking `access-dashboard` | 🔴 open — blocks 403-path QA |
| BC-D | Blank permission row still created by `AdminUserSeeder:37` | 🟡 open — catalogue filters it server-side; UI unaffected |
| BC-G | Secteurs/Products/Admins unpaginated | 🔴 open — blocks M2c-deferred extraction |
| BC-H | No bounded endpoint for relation pickers (`per_page` max 100) | 🟡 open — bites at scale in M3.3+ |
| BC-B / BC-I | Deletes have no in-use guard → 500 instead of domain 409 | 🟡 open — per capability |
| BC-L | Agent/Client lists accept no `sort` param | 🟡 open — constrains `DataTable` |
| BC-C | No granular reference-data permissions | 🟢 non-blocking |
| BC-E | `exposed_headers` must include `X-Request-Id` when B-4 lands | 🟢 non-blocking |
| BC-F | Contradictory docs on villes 403 envelope | 🟢 docs only |
| BC-J / BC-K | `Product.value` semantics; missing composite unique index | 🟢 non-blocking |
| — | `view-permissions` permission (B-6 deferred the OR-gate cleanup) | 🟢 non-blocking |

## Domain inventory

```
src/domains/
├── auth/                  M1-C
├── reference/
│   ├── villes/            M1   (paginated · search · sort)
│   ├── secteurs/          M2a  (unpaginated · 1 relation filter)
│   └── products/          M2b  (unpaginated · 1 enum filter · money)
└── network/
    └── admins/            M3.1 (unpaginated · granular permissions · picker)
```
