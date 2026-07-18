# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-19_

---

## Current focus

**M3.2 — Managers.** The second Network domain and the **first genuinely paginated
resource since Villes**.

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) + this documentation system — committed

⚠️ **Not yet pushed to origin.** Confirm with the user whether to push before starting M3.2.

## Next task

Implement **Managers** (`GET /admin/agents/managers`) — audited, contract below.

| Aspect | Contract |
| --- | --- |
| Endpoint | `GET /api/v1/admin/agents/managers` |
| Permission | `view-agents` (list) · `create-agent` · `update-agent` · `block-agent` · `activate-agent` · `manage-agent-status` · `delete-agent` |
| Envelope | **`{success: true, data: <paginator>}`** ← *second* envelope shape, not Villes' `{data, links, meta}` |
| Pagination | ✅ `per_page` (max 100) |
| Search | ✅ `nom`, `prenom`, `num_compte`, `num_abonnement` |
| Filters | `status` (active\|blocked\|inactive) · `ville` · `ville_sous_responsabilite` · `date_from` · `date_to` |
| Sort | ❌ **no `sort` param** — hardcoded `date_ajout DESC` (BC-L) |
| Status | ✅ 3-value **enum** — first real `StatusBadge` evidence |
| Money | ✅ `montant_avance` (`decimal:2`) — first `MoneyAmount` evidence |
| Relations | `commercials` (hasMany) + `withCount` |

## Files likely to be modified

**New** — `src/domains/network/managers/`:
`model/` · `api/` · `queries/keys.ts` · `queries/` · `components/` · `pages/` ·
`routes.tsx` · `index.ts` · tests

**Modified** (one line each, as with every prior domain):
- `src/app/router/routes.tsx` — spread `...managersRoutes`
- `src/app/navigation/nav.ts` — add nav item to the *Réseau* group
- `src/app/router/route-authorization.test.tsx` — add path to `domainPaths`
- `src/infrastructure/permissions/registry.ts` — add the agent permissions

## Backend dependencies

- **BC-L** — no `sort` param on agent/client lists. Ship **without** sortable headers.
- **BC-H** — relation pickers bounded at `per_page=100`. Bites in M3.3 (commercials
  need a manager picker), not M3.2.
- **BC-A** — no seeded account lacking `access-dashboard`; 403-path QA still unverifiable.
- Backend runs at `http://127.0.0.1:8000`; frontend dev at `http://localhost:5173`.

## Known follow-ups

- [ ] **FE-2 — nested-route guard.** `withPermissionGuards` is shallow; a child route's
      own `handle.permission` is **silently ignored**. **Fix before shipping any detail
      page.** Highest-probability M3 defect.
- [ ] **FE-1 — test flake** (~1-in-19). Error-state assertions run 951–1049 ms against a
      1000 ms default `findBy` timeout. Fix = explicit `{timeout: 3000}` on ~8 assertions.
      Recommended before M3.2's larger suite.
- [ ] **Gate G2 formal closure** — amendments G2-A/E/F need adoption; R7 estimate needs
      team agreement. All evidence criteria already pass.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, unmodified across four
  resources. Adding a domain concept to any of them breaks the M2c/G2 result.
  `ListPage` must **never** own table rendering.
- 🚫 **Do not extract** `DataTable`, `FilterBar`, `StatusBadge`, `MoneyAmount`,
  `EntityChip`, the resource-definition module, or a URL-filter hook — Managers is only
  the **second** paginated resource. See `decisions.md` ADR-0006.
- 🚫 **Do not add pagination/search/sort UI** to Villes-adjacent screens whose API lacks
  it (ADR-0009). Managers *does* paginate and search — build those; **do not** build
  sorting (BC-L).
- 🚫 **Do not modify existing tests** to accommodate an implementation. If a test needs a
  behavioural change, stop and explain first.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** If an endpoint is missing, stop and raise a
  backend consultation item.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012).

## Recommended first verification steps

```bash
cd C:\Miza\frontend-v2
git status                 # expect: uncommitted permission-selector work
pnpm test:ci               # expect: 238/238 across 20 files
pnpm lint && pnpm typecheck
```

Then, **before writing any code**:

1. Read `docs/project-status.md` (state) and `docs/decisions.md` (why).
2. Re-read the Managers contract **from the backend source**, not from this file:
   `app/Http/Controllers/Api/V1/Admin/AgentController.php::indexManagers`.
   Verify the envelope, filters and the absence of a `sort` param yourself.
3. Verify against the **live** endpoint if the backend is running — code and runtime
   have diverged before.
4. Copy the structure of `src/domains/network/admins/` — do not invent a new shape.
5. Present a plan and wait for approval before implementing.

## Session workflow

At the end of every implementation session:

- [ ] Update `project-status.md` (current state)
- [ ] Update `next-session.md` (this file)
- [ ] **Append** to `decisions.md` only if a real architectural decision was made
- [ ] Never rewrite or delete a historical decision
