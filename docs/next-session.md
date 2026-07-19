# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-19_

---

## Current focus

**M3.2 — Managers is COMPLETE and UNCOMMITTED.** The next milestone is **M3.3 —
Commercials**, but read "Before anything else" first: there is uncommitted work and one
raised follow-up awaiting a decision.

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers** — implementation, tests and documentation **complete, uncommitted**

Branch `main` is **level with `origin/main` at `05a514a`.**

## Before anything else

### 1 · The working tree holds an entire completed milestone

M3.2 was implemented but **not committed** — the session was instructed not to. Nothing
is half-finished; all gates pass. Confirm before starting new work:

```bash
cd C:\Miza\frontend-v2
git status                 # expect: the files listed below, uncommitted
pnpm test:ci               # expect: 279/279 across 21 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

**New** — `src/domains/network/managers/` (11 files): `model/manager.ts` ·
`api/managers-api.ts` · `queries/keys.ts` · `queries/managers-queries.ts` ·
`components/manager-form-sheet.tsx` · `components/manager-status-dialog.tsx` ·
`components/manager-ville-filter.tsx` · `pages/managers-list-page.tsx` ·
`pages/managers-list-page.test.tsx` · `routes.tsx` · `index.ts`

**Modified** (one integration line each, plus the permission block):
`src/app/router/routes.tsx` · `src/app/navigation/nav.ts` ·
`src/app/router/route-authorization.test.tsx` · `src/infrastructure/permissions/registry.ts`

**Docs**: `project-status.md` · `next-session.md` · `decisions.md` (ADR-0014 appended —
**append-only, do not rewrite**).

### 2 · FE-1 is raised and awaiting a decision — do this first

**Severity was raised by M3.2 and it now has real evidence.** Five older test files call
`findByRole("alert")` on the **1000 ms default** while those assertions take **951–1240 ms**.

- In isolation the suite is green (3 consecutive 279/279 runs), with the historical
  ~1-in-N single failure appearing once in `villes-list-page`.
- **Under CPU contention it collapses: 22 failures across 8 files**, every one an
  error-state assertion, on a run started while `pnpm build` was still finishing.

CI will hit contention before a developer does. **Fix it before M3.3 grows the suite again.**

The fix is mechanical — add `{timeout: 3000}` as `findByRole`'s third argument at:

| File | Lines |
| --- | --- |
| `src/domains/reference/villes/pages/villes-list-page.test.tsx` | 114, 132, 148, 172, 437 |
| `src/domains/network/admins/pages/admins-list-page.test.tsx` | 184, 202, 740, 795 |
| `src/domains/reference/secteurs/pages/secteurs-list-page.test.tsx` | 153, 172, 512 |
| `src/domains/reference/products/pages/products-list-page.test.tsx` | 171, 189, 501 |
| `src/domains/auth/pages/login-page.test.tsx` | 77, 96 |

`managers-list-page.test.tsx` already carries it (467, 486, 795) — copy that form.

**It was deliberately left undone.** It touches five other domains' test files, which is
outside M3.2's scope, and this file forbids modifying existing tests without raising it
first. **It changes no assertion — only the wait budget** — but it is the next session's
call to make, not the last one's.

## Next task — M3.3 Commercials

The third Network domain. **Its contract has NOT been verified — verify it before
implementing.** Do not assume it mirrors Managers.

What is already known, and what it implies:

- **Same controller, same permission set.** `AgentController` serves both;
  `VIEW_AGENTS`, `UPDATE_AGENT`, `BLOCK_AGENT`, `ACTIVATE_AGENT` are **already
  registered** and need no registry change.
- **The index method is different** (`indexCommercials`, not `indexManagers`). Its
  transform, filters and envelope must be **read from source** — Managers' contract was
  found wrong in three material ways when it was verified, so inheriting it by assumption
  is exactly the mistake that was already made once.
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

## Corrections to the previous handover

Two statements in the last version of this file were wrong and are corrected here:

- ❌ *"`create-agent` is still registered so M3.6 inherits it."* **It is not registered,
  deliberately.** `registry.ts` states its own rule — entries are added per resource,
  never ahead of the domain that uses them — and M3.2 has no create action. `create-agent`,
  `manage-agent-status` and `delete-agent` are all documented as intentionally absent, with
  the reason, in the registry's agent block. **M3.6 adds `create-agent` when it adds the
  wizard.**
- ❌ The pre-verification contract table. Already superseded before implementation; the
  verified one is now encoded in the code and its comments. `model/manager.ts` and
  `api/managers-api.ts` are the live record of it.

## New backend findings

- **BC-T** 🔴 **defect — the Managers Block action ships dead.**
  `PUT /admin/agents/{id}/block` is gated on `permission:block-agent`
  (`backend/routes/api.php:220`), but `RolePermissionSeeder.php:43-48` **never creates
  that permission**. Verified live against the running backend: a super-admin token 403s
  (`Spatie\Permission\Exceptions\UnauthorizedException`) on block while passing the gate
  on activate. The permission is unholdable, so `has('block-agent')` is false for
  everyone and **the Block button never renders in production**.

  🚫 **Do not "fix" this in the frontend.** The gating mirrors the server exactly, which
  is the rule. Re-gating Block onto `manage-agent-status` or `delete-agent` would offer a
  control the server refuses. The fix is one line in the backend seeder, and when it
  lands the button starts working with **no frontend change**. See `project-status.md`
  for the full evidence table.

- **BC-S** 🟡 **limitation** — `agents.ville` is a free-text **column**, not a foreign key
  to `villes`. The Managers city filter is a select over the reference set (the backend
  filters `ville` on exact equality, so free text would be a control that appears to work
  and does not), but **a manager whose ville was typed differently from the reference list
  cannot be selected**. The honest fix is a backend distinct-values endpoint.
  **Do not invent it.** Documented in `manager-ville-filter.tsx`.

BC-N/O/P/Q/R all survived implementation unchanged — see `project-status.md` for how each
was handled. None required a workaround.

## Known follow-ups

- [ ] **FE-1 — test flake. Now the top priority.** See "Before anything else" above:
      evidence, exact file/line list, and why it was left for this session to decide.
- [ ] **FE-2 — nested-route guard.** `withPermissionGuards` is shallow; a child route's
      own `handle.permission` is **silently ignored** in favour of its parent's. M3.2
      contributed no nested route, so it stayed non-blocking. **It blocks the deferred
      detail-page milestone and must be fixed before the first nested route exists** —
      it is an authorization hole, not a cosmetic defect.
- [ ] **BC-T — raise with the backend.** One line in `RolePermissionSeeder`. Until then
      the Managers Block action cannot be invoked by anyone. Frontend needs no change.
- [ ] **BC-H before the M3.3 manager picker** — see the M3.3 section.
- [ ] **Two M3.2 test gaps**, found during the commit-readiness pass and deliberately
      left (the pass was scoped to add no tests): there is **no loading-state assertion**
      and **no assertion that the list renders no detail-page links**. Both are in-scope
      M3.2 behaviours the suite does not currently pin. ~10 lines, touching no existing
      test. Worth adding when M3.3 next opens that file.
- [ ] **Gate G2 formal closure** — amendments G2-A/E/F need adoption; R7 estimate needs
      team agreement. All evidence criteria already pass. _Governance, not a blocker._
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] **Money representation — settled and now shipped.** `avance_total` is consumed as
      the backend-owned **preformatted string**: never parsed, never converted to a float,
      no shared money abstraction. `formatMoney` takes a `number` and would require exactly
      the parse this avoids. A test pins the verbatim rendering.

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, now unmodified across **five**
  resources. Managers absorbed pagination, a status enum and money without touching them.
  `ListPage` must **never** own table rendering.
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
  behavioural change, stop and explain first. _(FE-1 is that explanation, already given.)_
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** If an endpoint is missing, stop and raise a
  backend consultation item. BC-S and BC-H are two standing examples.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012). Managers' flat
  paginator is a fifth distinct envelope; `fromLaravelPage` was **not** bent to fit it.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
