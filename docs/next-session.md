# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-07-19_

---

## Current focus

**M3.4 — Clients is COMPLETE, COMMITTED AND PUSHED this session** (frontend;
see the commit hash in this session's own summary), alongside a **backend-only
dev fixture** (`DevClientSeeder`, committed and pushed separately in
`C:\Miza\backend`). **M3 (Network / identity graph) has now shipped all four
list-management resources — Admins, Managers, Commercials, Clients.** The
next milestone is **M3.5 — Client bulk-assign. Not started.**

## Last completed work

- **M3.1 Admins** — committed as `1240118`
- **Admin permission selector** (B-6 catalogue) — committed as `97905a3`
- **Documentation system** (`session-bootstrap.md`, CLAUDE.md rules) — committed as `05a514a`
- **M3.2 Managers**, plus its live-validation nullability fix — committed as
  `d91d9a2` and `3b84d51`
- **M3.3 Commercials**, plus city-select and multi-city-selector follow-ups —
  committed as `700d99f`
- **M3.4 Clients** — implemented, tested, manually validated end to end
  against the real backend, and **committed and pushed this session** (see
  the commit hash in this session's own summary)
- **`DevClientSeeder`** (backend) — a dev-only fixture seeder, added to
  unblock M3.4's manual validation (the dev database had zero clients),
  committed and pushed separately in the backend repository

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect the M3.4 commit at HEAD, pushed
pnpm test:ci               # expect: 388/388 across 23 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

## What M3.4 shipped

List with server pagination, search, three filters (`status`, `assigned`,
`ville_comercial`), edit (two fields: `phone`, `ville`), a single status
toggle (`PATCH /{id}/status` — not a block/activate pair), permission gating,
and loading/empty/error states. **No sorting, no create, no delete, no
detail page** (ADR-0014), **no assign/reassign/unassign, no bulk-assign**
(M3.5's own job), **no reset-password, no statistics, no map/location
editing** — all deferred by explicit decision, not by contract necessity.

Its contract was verified independently from `ClientController` — not
inherited from the Agent domains by resemblance. `index()` performs **no
`transform()`** (unlike every Agent domain), so the mapper deliberately
excludes several wire fields that ride along unused (`agent_id`,
`secteur_comercial`, `dept_to_commercial`, lat/long, `otp_*`,
`last_login_at`, `updated_at`) per ADR-0008. Clients carries a **third
status vocabulary** (`active`/`blocked`/`pending` — distinct from the Agent
domains' `active`/`blocked`/`inactive`), and `pending` clients originate
only from the public OTP signup flow, never from this milestone's own
tooling. `ClientStatusDialog` computes its single available action from
`client.status !== "active"` rather than reusing the two-dialog
block/activate pattern the Agent domains use — there is only ever one real
endpoint here.

**Manual UI validation was blocked by empty dev data, then unblocked
correctly, not worked around.** The dev database had zero clients and
Create Client is out of scope, so there was no in-product way to seed one.
`DevClientSeeder` (backend, dev-only, environment-guarded, idempotent via
`firstOrCreate` on the unique `phone` column) was added, modelled on the
existing `DevAgentSeeder` precedent. It resolves its commercial
**dynamically** (`Agent::isCommercials()->active()->first()`) rather than
assuming `agent_id = 2` — confirmed wrong in this environment (the only
commercial is id `636`). Verified end-to-end against the real running
backend: `GET /admin/clients` plus its `status` and `assigned` filters all
return the expected rows. **Manual UI validation then passed.**

## Backend findings from M3.4

- **BC-W** 🟡 **defect, new.** `ClientController`'s single-record methods use
  `findOrFail`, not caught specifically, so a nonexistent client id 500s
  instead of 404ing. Live-confirmed. Not reachable through this UI (no
  detail page, no direct id navigation).
- **BC-N** 🔴 **defect, third confirmed instance.** `ClientController::update()`
  validates inside a bare `catch (\Exception)` — a duplicate-phone update
  returns 500, not 422. Same pattern as the Agent domains' `index()`/`update()`.
- **BC-U** 🟡 **limitation, third confirmed instance.** The `update()`
  validator has no `nullable` for `ville_comercial`, though the column
  allows null — a client's city can never be explicitly cleared through
  this UI.

See `project-status.md` for the full M3.4 write-up, including what was
deliberately not modelled and why.

## Known follow-ups

- [ ] **FE-1 — test flake, not touched this session.** Five older test
      files' `findByRole("alert")` calls still run against the 1000 ms
      default while taking 951–1240 ms. Recommended before the suite grows
      further — it now has 43 more tests in it than when this was last
      raised (388 total).
- [ ] **FE-2 — nested-route guard.** Unchanged; still non-blocking. All four
      M3 list resources now ship with no nested route, so this stays
      dormant until the first detail page is built.
- [ ] **BC-W — raise with the backend, new this session.** See above.
- [ ] **BC-N — raise with the backend.** Now confirmed on three controllers
      (`indexManagers`/`update`, `indexCommercials`/`update`,
      `ClientController::update`) — worth fixing once, generically, rather
      than per-controller.
- [ ] **BC-U — raise with the backend.** Now confirmed on three fields
      across two controllers (`num_d_abonnement`, `ville` on Agents;
      `ville_comercial` on Clients) — same missing-`nullable` pattern each
      time.
- [ ] **BC-V — raise with the backend, or seed secteurs first.** Unchanged
      from M3.3 — `agents.secteur` has no FK and no seeded values.
- [ ] **BC-S — raise with the backend.** Unchanged from M3.3 — spans two
      columns (`ville`, `ville_actuelle`), no FK to `villes` on either.
- [ ] **Rule-of-Three / shared-extraction decision — now due, not deferred.**
      M3.3's own deferral was explicitly conditioned on "until Managers,
      Commercials and Clients are all built" — that condition is now met.
      `DataTable` and `FilterBar` read as satisfied under the cross-resource
      interpretation (4 resources each). `StatusBadge` reaches "3" by count
      but only 2 distinct enum vocabularies exist. `MoneyAmount`'s evidence
      is now 3 *divergent* shapes, arguably against one shared component,
      not for it. The URL-filter-hook wording question (per-resource vs.
      cross-resource threshold) is still unresolved. See the full tally in
      `project-status.md`. **This is the next actual decision point for
      shared extraction — not something to defer again by default.**
- [ ] **Gate G2 formal closure** — unchanged, governance only.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
- [x] **M3.4 Clients — complete, tested, manually validated.** See above and
      `project-status.md`.
- [x] **`DevClientSeeder` added and verified live** — see above.
- [x] Everything M3.3 and its two follow-ups closed out (city-select,
      multi-city selector, Block/Activate investigation) — see
      `project-status.md`, unchanged this session.

## Next task — M3.5 Client bulk-assign

**Not started. Do not begin implementation without a fresh discovery pass**,
per the same discipline M3.2/M3.3/M3.4 each required — assume nothing about
the bulk-assign endpoint's shape, permission, or constraints from having
just built Clients' list screen.

What is already known, and what it implies:

- `assign-client` is a seeded, real permission, not yet registered in the
  frontend registry (deliberately — M3.4's own rule: entries are added per
  resource, never ahead of the domain that uses them).
- The roadmap names bulk-assign as its own M3 deliverable, distinct from
  the single-client assign/reassign/unassign actions M3.4 also deferred —
  confirm from source whether the backend exposes one bulk endpoint or
  requires N calls to a single-assign endpoint before assuming either shape.
- `COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN` (found during M3.3's manager-field
  investigation) is an Agent-side reassignment guard — check whether an
  analogous business rule exists on the Client-assignment side before
  assuming assignment is unconditional.
- Re-run the same nullability and contract-verification discipline as
  M3.2/M3.3/M3.4: read the actual controller and validator before typing
  anything.

## Things that MUST NOT be changed

- 🚫 **`src/shared/components/patterns/`** — six components, unmodified
  across **seven** resources now. `ListPage` must **never** own table
  rendering.
- 🚫 **Do not extract** `DataTable`, `FilterBar`, `StatusBadge`,
  `MoneyAmount`, `EntityChip`, the resource-definition module, or a
  URL-filter hook **without first making the now-due Rule-of-Three decision**
  recorded above and in `project-status.md`.
- 🚫 **Do not add sorting to Managers, Commercials or Clients.** None of the
  three endpoints accept a sort parameter of any kind (BC-L for the Agent
  domains; Clients' `index()` has no sort parameter either, confirmed from
  source).
- 🚫 **Do not "fix" the case-sensitive search placeholder or the "Joined
  before" label** on Managers or Commercials. Both describe real backend
  behaviour (BC-O, BC-P). Clients has no date filter at all — do not add one.
- 🚫 **Do not parse `avanceTotal`** (Managers/Commercials) or **`solde`**
  (Clients). Both are pre-formatted strings from the backend, rendered
  verbatim, by two genuinely different mechanisms (`bcadd` accessor vs. a
  plain `decimal:2` cast) — see the `MoneyAmount` tally note.
- 🚫 **Do not add a secteur filter to Commercials** without first seeding
  real secteurs and building an options source (BC-V).
- 🚫 **Do not add a manager field to the Commercials edit form.**
  Reassignment is the Agent Transfers feature, not a plain field edit.
- 🚫 **Do not revert `ville`/`ville_actuelle`/`ville_comercial` to free-text
  inputs.** All three are exact-match filters over real Villes names; a
  select is what the contract supports.
- 🚫 **Do not send `ville_sous_responsabilite` as an array.** ADR-0015: it
  is still a single `string`. Reuse the `", "`-joined convention for any
  future field with the same shape.
- 🚫 **Do not build a second block/activate dialog pattern for Clients.**
  There is exactly one status endpoint (`PATCH /{id}/status`); the existing
  `ClientStatusDialog` already covers all three status values correctly.
- 🚫 **Do not assume `agent_id = 2` (or any other hardcoded agent id)
  anywhere, including in new seeders or fixtures.** Confirmed wrong in this
  environment. Resolve agents dynamically by role/status, as
  `DevClientSeeder` and `DevAgentSeeder` both do.
- 🚫 **Do not register `DevClientSeeder` in `DatabaseSeeder`.** It is a
  dev-only fixture, deliberately opt-in, matching `DevAgentSeeder`'s own
  rationale — these rows are domain data, not authorization fixtures.
- 🚫 **Do not add a boot-time `/me` permission refresh.** ADR-0003 forbids
  this deliberately.
- 🚫 **Do not modify existing tests** to accommodate an implementation. If a
  test needs a behavioural change, stop and explain first.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** BC-S, BC-H, BC-N, BC-U, BC-V and
  BC-W are all standing examples of disclosed limitations, not problems to
  route around.
- 🚫 **Do not merge mappers or key factories** across domains (ADR-0012).
  Clients has its own mapper and key factory, not shared with the Agent
  domains, despite superficially similar shapes.
- 🚫 **Do not assume a field is non-nullable because every fixture so far
  has had one.** Check the migration column-by-column, every time — this is
  now the third domain where it mattered.
- 🚫 **Do not add Create Client, Delete Client, or any assign/reassign/
  bulk-assign/reset-password/statistics/detail-page/map-editing UI without
  a fresh scope approval.** All were explicitly deferred by decision for
  M3.4, not because the backend lacks the endpoints.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
