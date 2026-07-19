# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-19_

---

## Current focus

**M3.2 — Managers is COMPLETE, live-validated, and committed.** The next milestone is
**M3.3 — Commercials**.

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers** — implementation, tests, live manual validation, and a defect found
  and fixed during that validation, all committed this session

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean, or only this doc's own reconciliation
pnpm test:ci               # expect: 279/279 across 21 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## What M3.2 shipped

List with server pagination, search, five filters (`status`, `ville`, `ville_sous_
responsabilite`, `date_from`, `date_to`), edit, block/activate, permission gating, and
loading/empty/error states. **No sorting** (BC-L), **no detail page** (ADR-0014), **no
create form** (M3.6).

**Verified live against the running backend** (`superadmin@test.com`, one dev-seeded
manager, `id 635`): envelope shape, pagination params, all five filters, search
case-sensitivity (BC-O), block → activate → block round-trip including the 400 no-op
guard, and the `view-agents`/`access-dashboard` permission gates. Loading/empty/error
states and the exact edit-drawer render were **not** visually confirmed — no browser
automation tool exists in this environment; those are covered only by the jsdom+MSW
suite.

## A real frontend defect was found live, and fixed, before commit

Not a backend-mirroring decision — an actual contract-verification miss. `numAbonnement`
and `ville` were modelled and handled as non-nullable strings throughout the domain, but
both are `nullable()` columns (`create_agent_table.php:15,34`), and the one manager
seeded in dev proved it: `num_abonnement: null` on a real record. The existing test
fixtures never seeded null in either field, which is exactly how this went unnoticed
through implementation and the automated suite.

**Mechanism, confirmed by testing both candidate outcomes directly against the live
update endpoint** (no browser tool to observe the DOM directly): `manager-form-sheet.tsx`
fed the null straight into `form.reset()`, which react-hook-form writes onto the
uncontrolled input's DOM `ref.value`. Assigning `null` there is either read back as the
empty string or the four-character string `"null"` depending on the engine — jsdom
(atypically) does the former; documented real-browser behaviour is the latter. Testing
both possible resulting payloads against the live backend:

| Payload | Live result |
| --- | --- |
| `num_d_abonnement: ""` | **500** — Laravel's empty-string-to-null middleware plus a validator with no `nullable` on this field (BC-U, below) |
| `num_d_abonnement: "null"` | **200 — silently persisted.** Proven by actually submitting it, then restoring the fixture via `php82 artisan tinker` since the HTTP API itself cannot null the field back (BC-U) |

Either way: editing the one manager this environment has, without touching the
subscription field at all, either corrupts it or hard-fails the save.

**Fixed.** `Manager.numAbonnement` and `Manager.ville` (and their `ManagerRow` wire
counterparts) are now typed `string | null`. The list cells fall back to `ABSENT`. The
edit form seeds both as `?? ""`, exactly matching how `villeSousResponsabilite` was
already guarded. All five gates re-run clean afterward; **no test needed changing** —
existing fixtures always populate both fields, so nothing in the suite exercised the null
path either way.

Files touched by this fix: `model/manager.ts`, `api/managers-api.ts`,
`components/manager-form-sheet.tsx`, `pages/managers-list-page.tsx`.

## Next task — M3.3 Commercials

The third Network domain. **Its contract has NOT been verified — verify it before
implementing.** Do not assume it mirrors Managers.

What is already known, and what it implies:

- **Same controller, same permission set.** `AgentController` serves both;
  `VIEW_AGENTS`, `UPDATE_AGENT`, `BLOCK_AGENT`, `ACTIVATE_AGENT` are **already
  registered** and need no registry change.
- **The index method is different** (`indexCommercials`, not `indexManagers`). Its
  transform, filters and envelope must be **read from source** — Managers' contract was
  found wrong in three material ways when it was first verified, and a fourth
  nullability gap slipped through even that verification pass. Inheriting Commercials'
  shape by assumption from Managers repeats a mistake already made twice.
- **Re-check nullability against the migration for every field, not just the ones that
  look nullable.** That is exactly what M3.2 missed: `ville` and `num_abonnement` didn't
  read as optional from their names or from any fixture, but the schema said otherwise.
  Cross-check `create_agent_table.php` column-by-column against whatever
  `indexCommercials`' transform emits, before assuming a type.
- **Commercials carry fields managers do not** — `manager_id`, `ville_actuelle`,
  `secteur` are nulled out for managers by `store()` but are real for commercials. Expect
  a manager relation and therefore a **manager picker**.
- 🔴 **BC-H bites here.** A manager picker needs a bounded options source, and the agents
  list is capped at `per_page=100`. If there are more than 100 managers, the picker is
  silently wrong. **Raise it before building the picker** — do not paginate a `<select>`
  and do not invent an unbounded endpoint.
- **BC-L applies again** — no `sort` parameter on agent lists. Ship without sortable headers.

Copy the structure of `src/domains/network/managers/` — it is the newest comparable
resource and the closest possible match.

## Backend findings from M3.2

- **BC-T** ✅ **resolved.** `block-agent` was never seeded, making Block uninvokable by
  anyone. The backend now creates it — verified live, block/activate round-tripped
  successfully including the no-op guard.
- **BC-U** 🟡 **limitation, still open.** `AgentController::update`'s validator has no
  `nullable` on `num_d_abonnement` or `ville`, though both columns allow null — so
  neither field can ever be explicitly cleared via the API. Discovered while restoring
  the dev fixture after the nullability testing above; the fixture had to be repaired via
  `artisan tinker`, bypassing the HTTP API entirely, because the API itself refused both
  `""` and `null` for the field. **Not a frontend defect** — the zod schema's `min(1)`
  requirement happens to route around it by coincidence, not by design. Worth a backend
  consultation item; not fixed here.
- **BC-S** 🟡 **limitation, still open.** `agents.ville` is a free-text column, not a
  foreign key to `villes`. The Managers city filter is a select over the reference set
  (backend filters `ville` on exact equality, so free text would silently fail), but a
  manager whose ville was typed differently from the reference list cannot be selected.
  Honest fix is a backend distinct-values endpoint. **Do not invent it.**

BC-N/O/P/Q/R all survived implementation unchanged — see `project-status.md` for how each
was handled. None required a workaround.

## Known follow-ups

- [ ] **FE-1 — test flake, top priority.** Five older test files call
      `findByRole("alert")` on the 1000 ms default while those assertions run
      951–1240 ms. In isolation the suite is green (repeated clean 279/279 runs); under
      CPU contention (e.g. `pnpm build` finishing just before `pnpm test:ci` starts) it
      collapsed to 22 failures across 8 files, reproduced twice this session. CI will hit
      this before a developer does. Fix is mechanical — `{timeout: 3000}` as `findByRole`'s
      third argument:

  | File | Lines |
  | --- | --- |
  | `src/domains/reference/villes/pages/villes-list-page.test.tsx` | 114, 132, 148, 172, 437 |
  | `src/domains/network/admins/pages/admins-list-page.test.tsx` | 184, 202, 740, 795 |
  | `src/domains/reference/secteurs/pages/secteurs-list-page.test.tsx` | 153, 172, 512 |
  | `src/domains/reference/products/pages/products-list-page.test.tsx` | 171, 189, 501 |
  | `src/domains/auth/pages/login-page.test.tsx` | 77, 96 |

  `managers-list-page.test.tsx` already carries it (467, 486, 795) — copy that form. Left
  undone again this session: it spans five other domains' test files, outside M3.2's
  scope, and this file forbids modifying existing tests without raising it first — raised
  twice now.

- [ ] **FE-2 — nested-route guard.** `withPermissionGuards` is shallow; a child route's
      own `handle.permission` is **silently ignored** in favour of its parent's. Still
      non-blocking — no nested route exists yet — but must be fixed before the first one
      does (the deferred detail-page milestone, ADR-0014).
- [ ] **BC-U — raise with the backend.** `nullable` missing from two `update()` validator
      rules. See above.
- [ ] **BC-S — raise with the backend.** Distinct-values endpoint for `ville`, or a real
      foreign key. See above.
- [ ] **BC-H before the M3.3 manager picker** — see the M3.3 section.
- [ ] **Two M3.2 test coverage gaps**, found during the commit-readiness pass and
      deliberately left (out of scope for that pass): no loading-state assertion, and no
      assertion that the list renders no detail-page links. ~10 lines, touching no
      existing test. Worth adding when M3.3 next opens that file. A third gap now exists
      too: no test pins the null-`numAbonnement`/null-`ville` render or edit path, since
      it was fixed by inspection and live testing rather than by a failing test.
- [ ] **Gate G2 formal closure** — amendments G2-A/E/F need adoption; R7 estimate needs
      team agreement. All evidence criteria already pass. _Governance, not a blocker._
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] **Money representation — settled and shipped.** `avance_total` is consumed as the
      backend-owned preformatted string: never parsed, never converted to a float, no
      shared money abstraction.
- [x] **BC-T — resolved this session.** See above.

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, unmodified across **five**
  resources. `ListPage` must **never** own table rendering.
- 🚫 **Do not extract** `DataTable`, `FilterBar`, `StatusBadge`, `MoneyAmount`,
  `EntityChip`, the resource-definition module, or a URL-filter hook. Managers is
  **evidence #1** for `StatusBadge` and only the **second** paginated resource — ADR-0006
  needs three genuinely comparable cases, and BC-G prevents a third from existing yet.
- 🚫 **Do not add sorting to Managers or Commercials.** The endpoints accept no sort
  parameter of any kind (BC-L). Adding one invents a capability the API lacks (ADR-0009).
- 🚫 **Do not "fix" the case-sensitive search placeholder or the "Joined before" label.**
  Both describe real backend behaviour (BC-O, BC-P). They change when the backend does.
- 🚫 **Do not parse `avanceTotal`.** It is a `bcadd` string, deliberately.
- 🚫 **Do not modify existing tests** to accommodate an implementation. If a test needs a
  behavioural change, stop and explain first.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** If an endpoint is missing, stop and raise a
  backend consultation item. BC-S, BC-H and BC-U are three standing examples.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012). Managers' flat
  paginator is a fifth distinct envelope; `fromLaravelPage` was **not** bent to fit it.
- 🚫 **Do not assume a field is non-nullable because every fixture so far has had one.**
  This is precisely how `numAbonnement`/`ville` went unmodelled. Check the migration.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
