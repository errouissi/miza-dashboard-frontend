# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-08-15_

---

## Current state

**M4 (Money) is COMPLETE. M5 (Stock) is COMPLETE at the implementation level.
M6 (Grattage — the seam) is COMPLETE, manual QA passed. M7 (Overview &
workspaces, Agent 360, Client 360) is the current milestone — Agent 360 AND
Client 360, the first two of its three composed surfaces, are both
COMPLETE, manual QA passed, committed and pushed.** The Overview widget
grid, the third and final M7 surface, has cleared discovery (the prior
backend-readiness blocker is resolved — see below) and its **Phase 1
(Foundation + decision queues) is IMPLEMENTED — automated QA passed —
MANUAL QA PENDING — UNCOMMITTED.** Do not start Phase 2. **Manual QA of
Phase 1 is the literal first thing to do next session, before anything
else.** See "Next task" below for the exact checklist.

- **Overview discovery is CLOSED.** The backend blocker disclosed by the
  frozen roadmap (`chartData`/`recentActivities`/`agentsOverview` possibly
  unrouted) is resolved: backend commit `6aa671f` on branch
  `feature/Update-claude` routed all three, alongside the pre-existing
  `GET /admin/dashboard/statistics`. **All four Dashboard endpoints are now
  routed, all four gated on `access-dashboard` alone, and there is no
  remaining blocking backend gap.** Full verification (exact contracts,
  response shapes, permission matrix, widget mapping, phase plan) is in the
  M7 Overview discovery report from this session — not re-copied here in
  full; re-read it before Phase 2 if the detail is needed again.
- **Overview implementation is now split into four phases** (re-planned
  from verified source, not the earlier tentative A/B split):
  **Phase 1 — Foundation + decision queues** (Pending Cheques, Pending
  Deposits, Overdue Grattage Invoices) — **implemented this session, see
  below.** Phase 2 — Statistics tiles. Phase 3 — Network/cash charts.
  Phase 4 — Recent activity + agents overview. Do not skip ahead to Phase 2
  before Phase 1's own manual QA passes and is committed.
- **Code / commit state — NOT clean. Read carefully before doing anything.**
  - Client 360 (all phases + both QA fixes) and Agent 360 — all committed
    and pushed, unchanged since the last checkpoint (`9cc464a`, `506e992`,
    `22f2ba9`, `55cc33d`, `47ab778`, `a595b0a`).
  - **Overview Phase 1 is implemented locally but deliberately
    UNCOMMITTED and UNPUSHED, pending manual QA** — `git status` will NOT
    show clean. This is the intended state, not an accident: do not commit
    it reflexively, and do not discard it. The working tree contains
    exactly:
    - `src/domains/overview/` (new) — `pages/overview-page.tsx` +
      its own test file, `components/pending-cheques-widget.tsx`,
      `components/pending-deposits-widget.tsx`,
      `components/overdue-grattage-widget.tsx`, `index.ts`.
    - `src/app/router/routes.tsx` (modified) — the index route (`/`) now
      renders `OverviewPage` instead of `WelcomePlaceholder`.
    - `src/app/router/app-shell.test.tsx` (modified) — the one assertion
      that checked the old placeholder's heading.
    - `src/app/placeholders.tsx` (DELETED) — `WelcomePlaceholder`, no
      longer referenced anywhere; its own docblock invited exactly this
      ("deleted by the milestone that replaces it").
    - `src/domains/grattage/invoices/index.ts` (modified) — widened to
      export the already-existing `useGrattageInvoicesQuery`/
      `GRATTAGE_INVOICE_LIST_DEFAULTS`/`GrattageInvoiceListParams`
      (Overdue Grattage widget's own read — no new query, no duplicate
      mapper).
    - `src/domains/money/deposits/index.ts` (modified) — widened to export
      the already-existing `DEPOSIT_TYPE_LABELS` (Pending Deposits
      widget's own type label).
- **A real bug was found and fixed during Phase 1 implementation, not left
  for QA to find**: the naive "check permission, then call the query hook"
  shape would have fired an unauthorized request from every widget —
  `useChequesQuery`/`useDepositsQuery`/`useGrattageInvoicesQuery` have no
  `enabled` option (every existing caller sits inside an already
  permission-gated route; Overview is the first caller composed with no
  such route guard). Fixed with an outer-gate + inner-content component
  split per widget (`PendingChequesWidget` → `PendingChequesContent`,
  etc.) — the same conditional-MOUNTING discipline `AgentStockPanel`/
  `ClientGrattagePanel` already established, not a change to any domain's
  query layer. Verified by test: zero requests fire for any widget whose
  permission is absent, in every permission combination.
- **Automated verification, this session**: 32/32 focused Overview tests;
  directly-relevant regression (Cheques, Deposits, Grattage Invoices,
  Agent 360, Client 360, app-shell, route-authorization) clean; a clean
  full-suite run at 1268/1268 across 62 files; `tsc -b`/`eslint .`
  (0 errors)/`prettier --check .` all clean; `vite build` succeeds. **None
  of this is manual QA** — see "Next task" below for what manual QA still
  owes.
- **FE-1 (test flake) is unchanged, still present, still non-blocking** —
  observed intermittently across several full-suite reruns this session,
  always a different, unrelated, untouched "retryable error"/"freshness
  retry" timing test, always passing clean standalone. Not caused by
  today's changes.
- **Tests: 1237/1237 across 61 files** was the count BEFORE today's
  Overview Phase 1 work; **1268/1268 across 62 files** is the count WITH
  it (still uncommitted). Run twice to rule out FE-1 — see above.
- **Manual validation**: Cheques' full workflow, Agent Stock Returns, all of
  M6 (Grattage Invoices, the restock-gate integration, Deposit↔Invoice
  linking, including the corrected Allocation capacity scenario), all of
  Agent 360, and now all of Client 360 (route/profile, status flow, Edit
  incl. Ville/Secteur dependency, Commercial reassignment incl. the
  same-Commercial disabled UX, Assignment History, Grattage purchase
  history incl. historical-Commercial independence, permission behavior,
  panel isolation) are manually validated against the real running backend.
  **Deposits, Debt Payments, Agent Transfers, Allocations and Bons (the M5
  resources) still have NOT had a manual browser pass of their own** —
  unaffected by M6/M7, still simply owed, none blocked.
- **M7 Agent 360 shipped, five phases plus two finalization passes**:
  workspace foundation (`c392a7e`); full role-aware Agent Edit, `manager_id`
  temporarily excluded pending a backend read (`21c6e05`); Money/Stock
  workspace panels (`2ff0d5a`); the Grattage Outstanding panel, the first
  real caller of `useGrattageOutstandingQuery` (`69f50aa`, fulfilling
  ADR-0026); the zero-stock Manager reassignment guard, closing the one
  genuine gap the completion review found against the frozen architecture's
  own named workflow (`1aa1d66`); a manual-QA finalization pass fixing two
  real `FormDrawer`/`FileUploadField` defects and adding Commercial Current
  Stock, the product breakdown, and Available Grattage (`bc54e55`); and,
  found during Client 360's own manual QA, a presentation clarification
  when the Grattage restock gate is blocked (`47ab778`). See
  `project-status.md`'s own "M7 — Agent 360" section for the full write-up
  and `decisions.md` ADR-0033/ADR-0034 for the permanent decisions.
- **Backend additions during Agent 360, all reused as-is, none re-derived
  client-side**: `GET /admin/agents/{agent}/stock-quantity`
  (`5302f99`, Commercial-only, `access-dashboard`) widened twice
  (`f9a6fe4` added `available_grattage`; `15aa704` added the `stock` product
  breakdown) — one endpoint, one query, three fields, all from a single
  `listOwnerStock()` call. `manager_id` reassignment validation is now
  eligible-manager-checked and atomic; `update()` now correctly 422s a
  validation failure instead of the prior generic 500.
- **M6's own carry-forward is now delivered**: the per-agent
  Outstanding-obligation UI view (`useGrattageOutstandingQuery`, previously
  domain-private) shipped as Agent 360's Phase 3.
- **M7 Client 360 shipped, three phases plus two manual-QA fixes**:
  foundation (`9cc464a`); Commercial relationship + assignment history
  (`506e992`); Grattage purchase history, the frozen requirement's final
  named capability (`22f2ba9`); the same-Commercial reassignment disable UX
  fix (`55cc33d`, an additive `FormDrawer.submitDisabled` prop, every other
  caller unaffected); and the related Agent 360 presentation fix found in
  the same QA pass (`47ab778`, see above). See `project-status.md`'s own
  "M7 — Client 360" section for the full write-up. No new ADR — both QA
  fixes reuse existing, already-decided infrastructure rather than
  introducing a new pattern.

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: NOT clean — Overview Phase 1's
                            # uncommitted files (see "Current state" above)
                            # plus this session's own docs checkpoint commit
                            # already on top of the last code commit
git log --oneline -8        # expect a docs-only checkpoint commit, then
                            # a595b0a, 47ab778, 55cc33d, 22f2ba9, c638414,
                            # 506e992, 9cc464a
pnpm test:ci               # expect: 1268/1268 across 62 files (WITH
                            # Overview Phase 1's own uncommitted tests)
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

**Do not run `git clean`/`git checkout -- .`/`git stash` reflexively because
`git status` looks "wrong" — the uncommitted Overview Phase 1 files ARE the
work. Manual QA them first (see "Next task" below), then commit.**

## Last completed work

- **M3.1 through M3.6** — see prior entries in this file's own git history, or
  `project-status.md`'s own write-ups. All committed; M3.6 is `5dd20e8`.
- **M4.1 Money infrastructure** — `a7d4b07`.
- **M4.2 Cheques, Phase 1+2 (list, read-only)** — `4b8f095`.
- **M4.2 Cheques, Phase 3A (creation)** — `a601ee0`.
- **M4.2 Cheques, Phase 3B+3C (pending queue, detail page, approve/reject/annuler)**
  — `bba78d3`.
- **M4.3 Deposits, Phase 1 (list)** — `dcb8380`.
- **M4.3 Deposits, Phase 2 (detail page)** — `6ab02a5`. `DepoResource` changed shape a
  second time underneath the M4 discovery pass's own earlier reading (commit
  `8786326`, unifying `index()`/`show()`/`store()` and adding
  `reject_reason`/`validated_by`/`validated_at`/`bank_name`/`proof_type`) — re-verified
  fresh at this phase's own start, not assumed from the discovery pass.
- **M4.3 Deposits, Phase 3 (validate/reject actions)** — `a64f42f`.
- **M4.3 Deposits, Phase 4 (creation)** — `4dd4d63`. M4.3 is now fully complete.
- **M4.4 Debt Payments** — `c0d3f36`. The third and final Money resource: list +
  submit only, no detail page (`show()`/`destroy()` are dead routes), no lifecycle
  (no `status`/`type` column at all). M4 is now fully complete.
- **Freshness-rule retrofit** — `7da7804`. Built `useFreshConfirm` (`shared/hooks/`)
  and retrofitted it onto all five existing irreversible Money dialogs (Cheques'
  Approve/Reject/Annuler, Deposits' Validate/Reject). See ADR-0018.
- **M5 Phase 1 — Agent Stock Returns** — `49af3b7`. The first Stock resource, the
  first domain with a real error-code registry population (13 codes), first caller
  of the newly-extracted `LineItemsEditor` (ADR-0019). Manually validated.
- **M5 Phase 2 — Agent Transfers** — `e559e76`. Mirrors Return's shape but its own
  15 error codes, permission names and `validation_summary` keys were each verified
  independently, not derived mechanically (ADR-0022) — several genuinely diverge
  from Return's own (see `project-status.md`'s own M5 Phase 2 section for the exact
  list). Its own domain-local Manager→Commercial picker (ADR-0021). Manual browser
  validation still owed.
- **M5 Phase 4 — Allocations** — `16aad37`. Genuinely different binding pair
  (`company_id` + `agent_id` role=manager, no cascade), load-bearing `montant`, two
  new validate-time gates (deposit capacity, team obligation), only 10 error codes
  (no role-mismatch family — a real contract fact). Added the read-only
  `GET /admin/companies` endpoint and `domains/reference/companies/`. See
  `project-status.md`'s own M5 Phase 4 section for the full write-up. Its own prior
  manual-validation blocker (no stock source existed) is resolved now that Bons has
  shipped.
- **M5 Phase 5 — Bons** — `a8239f9`. The fifth and final Stock resource: the only
  cancel lifecycle in Stock (BC-AB, reuses `ConfirmActionDialog`'s existing `reason`
  slot) and the only mandatory file upload (`evidence`, reuses Cheques' own
  `FormData` pattern). Only 9 error codes, no `BON_STOCK_INSUFFICIENT` —
  `validateBon()` has no capacity check at all; `BON_CANCEL_STOCK_INSUFFICIENT`
  (cancel-only) is the sole stock-insufficiency gate. Added the read-only
  `GET /admin/suppliers` endpoint and `domains/reference/suppliers/`. No manual
  validation blocker (Bons is the stock source), but not yet performed.
- **Stock-aware product selection + backend-generated numbers** — `6dea118`. A
  post-Bons backend contract update integrated into Allocations'/Transfers' own
  create forms and detail pages: `allocation_number`/`transfer_number` removed
  entirely (backend-generated, ADR-0024); "add line" pickers now read
  `GET /admin/companies/{company}/stock`/`GET /admin/managers/{manager}/stock`
  instead of the unfiltered product catalogue (ADR-0025) — both are genuinely
  DEPENDENT queries (fetch only once the parent resource resolves), a real test-
  timing difference from the independent query they replaced.
- **M6 Phase 1 — Grattage Invoices** — `b1713af`. The domain itself: list/detail/
  cancel, `access-dashboard`-gated. No admin Create/Settle (backend-initiated,
  out of scope). List filters are page/status/date-range only.
- **M6 Phase 2 — Grattage Outstanding restock-gate domain** — `8514662`. Data
  layer only, no UI. Exports only the narrow `useGrattageRestockGateQuery
  (agentId)`; the full `useGrattageOutstandingQuery` stays domain-private,
  unexported, awaiting an M7 caller. ADR-0026.
- **M6 Phase 3 — Stock → Grattage restock-gate integration** — `0ce24e2`.
  Wired `useGrattageRestockGateQuery` into `AgentTransferDetailPage` (hard
  gate, unchanged backend contract) and `AllocationDetailPage` (then-current
  team-obligation gate). ADR-0027.
- **Backend contract change + correction — Allocation capacity** — `59888a5`.
  Backend commit `9af5d00` removed Allocation's team-wide hard block for a
  numeric, settlement-aware capacity formula. Re-verified from source, then a
  targeted correction removed the now-invalid proactive gate from
  `AllocationDetailPage`/`ValidateAllocationDialog` and the now-dead error code
  from the registry. Agent Transfer's own gate untouched (ADR-0028). ADR-0029,
  and ADR-0032 for the standing no-client-side-derivation rule. Do NOT
  re-add a client-side capacity derivation — see "Things that MUST NOT be
  changed" below.
- **M6 Phase 4 — Deposit ↔ Grattage Invoice linking** — `8d5bf60`. Invoice →
  Deposit is a literal-path link with a status-aware label (ADR-0031).
  Deposit → Invoices is a private, domain-local read inside Deposits (Option B
  — explicitly chosen over extending Grattage's own public surface, to avoid a
  second Money↔Grattage domain edge). Uses the backend's `deposit_id` filter on
  `GET /admin/grattage-invoices` (commit `057c8b2`). ADR-0030.
- **M6 documentation-sync + invalidation-map cleanup** — `f843008` (comment-only)
  plus that session's own doc-sync commit. M6 is fully complete, manual QA
  passed.
- **M7 Agent 360 workspace foundation** — `c392a7e`. `AgentWorkspacePage`, a
  flat `/network/agents/:id` route reached from Managers'/Commercials' own
  list rows — the first `WorkspacePage`-pattern page in the product. Identity/
  profile, document links, Block/Activate. Models `show()`'s raw
  `$agent->toArray()` as a discriminated union on `role`.
- **M7 Agent 360 full Agent Edit** — `21c6e05`. Every backend-supported
  editable field, verified against `update()`. Existing file/photo previews
  via a new, additive `existingUrl` `FileUploadField` contract. `manager_id`
  temporarily excluded — no authoritative Commercial stock read existed yet.
- **M7 Agent 360 Money/Stock workspace panels** — `2ff0d5a`. Composed via
  mechanism 1 (page-level composition, FTA §4) from Money's/Agent Transfers'/
  Agent Stock Returns' own public surfaces. Every panel independently
  `PanelBoundary`-wrapped and permission-gated, firing in parallel.
- **M7 Agent 360 Grattage Outstanding panel** — `69f50aa`. The per-agent
  Outstanding view M6 carried forward, delivered: `useGrattageOutstandingQuery`
  exported from its previously-private `index.ts` for the first time
  (fulfilling ADR-0026). Role-branched, with a Commercial-scoped
  restock-gate wording guardrail and a deliberately coarse Manager view.
- **M7 Agent 360 completion item — zero-stock Manager reassignment guard** —
  `1aa1d66`. Unblocked by backend commit `5302f99`
  (`GET /admin/agents/{agent}/stock-quantity`): the Manager field on a
  Commercial's Edit form is now live, seeded, sourced from
  `useManagerOptionsQuery`, and disabled until the authoritative read confirms
  `stock_quantity === 0` (fail-closed on loading/error/no-permission). The
  backend's own atomic, locked `update()` guard remains sole authority.
- **M7 Agent 360 manual-QA finalization** — `bc54e55`. Two real defects found
  in browser testing and root-caused from source (not patched around): a
  `FormDrawer` scrolling trap (fixed with `min-h-0 flex-1` plus a dedicated
  scroll region) and a `FileUploadField`/Radix `overflow-hidden` interaction
  that blanked the drawer on file replacement (fixed with `overflow-clip`,
  confirmed live in Chrome). Plus Commercial Current Stock, its product
  breakdown, and Available Grattage — all three reusing the SAME
  stock-quantity read, widened by backend commits `f9a6fe4`/`15aa704`, no new
  query. See `decisions.md` ADR-0033/ADR-0034.
- **M7 documentation-sync** — `14effa8`. M7 Agent 360 is now fully complete,
  manual QA passed.
- **M7 Client 360 — initial discovery pass** — docs-only checkpoint, no
  source changes. Discovery-only: produced the 6 follow-up questions closed
  by the next session's own focused discovery pass before any code was
  written (superseded — see the three phases below).
- **M7 Client 360 Phase 1 — foundation** — `9cc464a`. Minimal `ClientDetail`
  model (`id`, `phone`, `status`, `ville`, `secteur`, `createdAt`,
  `commercial`) — deliberately excludes `solde`/`debt`/`dept_to_commercial`/
  location/OTP fields (no authoritative Client-receivable semantics exist —
  verified from `SalesService`'s own backend docblock). `ClientWorkspacePage`
  at `/network/clients/:id`, reached from the list's own new "View" action.
  `ClientFormSheet`/`ClientStatusDialog` are REUSED verbatim from the list
  (M3.4), not forked — a genuine divergence from Agent 360's own
  fresh-parallel-implementation choice, justified because these two were
  already domain-shared, single components before Client 360 existed. Fixed
  a real, pre-existing defect found during this phase: `ClientStatusDialog`
  previously offered "Activate" to a `pending` client, but
  `Client::toggleStatus()` 400s that transition outright — pending clients
  now correctly get no status action anywhere. Edit widened to include
  `secteur` (city-scoped select, reusing the agent-onboarding wizard's own
  `useSecteursQuery({villeId})` mechanism) — the "clear Secteur when City
  changes" logic is deliberately wired into the City `<select>`'s own
  `onChange`, NOT a `useEffect` keyed on the derived Villes-lookup id — a
  real race was found and fixed during implementation where an effect-based
  approach wiped a freshly-seeded Secteur value; see the component's own
  docblock for the full empirical reasoning before reintroducing one.
- **M7 Client 360 Phase 2 — Commercial relationship + assignment history** —
  `506e992`. Backend commit `7066ffa` (append-only
  `client_assignment_histories`, `GET /admin/clients/{id}/assignment-history`,
  `view-clients`) verified fresh from source first. `ClientCommercialSection`
  reads `ClientDetail.commercial` ONLY, never assignment history — enforced
  by the component's own prop type having no history field at all, with a
  dedicated regression test constructing a deliberate detail/history
  mismatch to prove it. Reassignment uses ONLY `PATCH /admin/clients/{id}/assign`
  (`reassignClient`) — NEVER `POST /admin/clients/{id}/assign`
  (`assignToAgent`), a same-path, different-method, genuinely different
  endpoint: the `POST` one also silently rewrites `ville`/`secteur` from the
  target Commercial, which this workspace's own Reassign action must never
  do. Same-target reassignment is a client-side no-op (no request fired,
  matching the backend's own no-history-row behavior) — not an invented
  error. `useAssignClientsBulkMutation` (pre-existing, M3.5) was re-verified
  and updated to also invalidate the new history key, since `7066ffa` means
  it now writes history rows too.
- **M7 Client 360 Phase 3 — Grattage purchase history** — `22f2ba9`.
  Widened `domains/grattage/invoices/` with the smallest sanctioned public
  export: `useClientGrattageInvoicesQuery`, nested UNDER the existing
  `["grattage-invoices"]` key prefix (`["grattage-invoices", "client",
  clientId, page]`), specifically so the four pre-existing invalidation-map
  events (`deposit.validated`/`deposit.rejected`/`deposit.created`/
  `grattage-invoice.cancelled`) continue to cover it via TanStack's own
  prefix matching — verified fresh from `invalidateForEvent`'s own source
  (`invalidateQueries({queryKey})`, no `exact: true`), NOT assumed. No
  `invalidation-map.ts` entries were added. `ClientGrattagePanel` is
  `access-dashboard`-gated, independent of the page's own `view-clients`.
  Each row's Commercial comes from THAT invoice's own `agent` relation —
  historical, never substituting `ClientDetail.commercial` — a client
  reassigned after an older purchase must still show who actually made that
  sale. A real stale comment was found and fixed in passing (`sales` was
  documented as "absent on index() rows"; `GrattageInvoiceController::index()`
  now eager-loads it identically to `show()` — re-verified fresh, comment
  corrected in both the api and model files, nothing else touched).
- **M7 Client 360 manual-QA fix — same-Commercial reassignment disable** —
  `55cc33d`. Manual QA found the Reassign button stayed enabled while the
  picker still showed the client's current Commercial — clicking it
  silently closed the drawer with no request and no feedback. No
  functional/audit-integrity bug existed (the backend's own
  `appendHistoryIfChanged` already makes a same-agent history row
  structurally impossible, and the frontend already skipped the request);
  this was UX-only. Fixed with an additive `FormDrawer.submitDisabled`
  prop (defaults `false`, every other caller unaffected) —
  `ClientReassignDrawer` disables Reassign whenever the selection still
  equals the current Commercial. The existing `onSubmit` same-target
  short-circuit is kept as defense-in-depth for a programmatic/Enter-key
  submit that bypasses the disabled button.
- **M7 Agent 360 manual-QA fix — blocked Grattage transfer capacity
  clarification** — `47ab778`. Found during the same Client 360 QA pass:
  Agent 360's Stock panel showed `available_grattage` with no indication
  it could be non-actionable while `restock_gate.blocked === true`
  (backend-confirmed: `blocked` has priority over the numeric capacity,
  and Transfer validation already enforces that order correctly).
  `CommercialStockTotal` now reuses the existing
  `useGrattageRestockGateQuery` hook (no new query) and shows a small
  contextual note only on a confirmed `blocked === true`; the numeric
  capacity is never hidden or zeroed.
- **M7 Overview — final discovery** — docs-only, no source changes.
  Re-verified backend commit `6aa671f` (`feature/Update-claude`) directly
  from source (routes, controller diff, the new feature-test file,
  `docs/api-endpoints.md`), not from the backend developer's summary alone
  — confirmed all three previously-unrouted `DashboardController` methods
  are now live behind the identical `access-dashboard` gate
  `/dashboard/statistics` already carries, with real `days`/`limit`
  input-bounding and a genuine PostgreSQL query-order bug fixed
  (`agentsOverview()`'s `select()` now precedes `withCount()`). Produced
  the full endpoint contract matrix, the frozen-purpose → widget mapping,
  the permission matrix, and the four-phase plan (Foundation, Statistics,
  Charts, Recent activity) — no implementation this pass.
- **M7 Overview Phase 1 — Foundation + decision queues** — implemented,
  automated QA passed, **NOT YET COMMITTED** (see "Current state" above
  for the exact file list and the permission-gating bug found and fixed
  during implementation). `/` now renders `OverviewPage` (replacing
  `WelcomePlaceholder`, deleted) with three independently-permission-gated,
  independently-`PanelBoundary`-wrapped decision-queue widgets — Pending
  Cheques (`VIEW_CHEQUES`), Pending Deposits (`VIEW_DEPOSITS`), Overdue
  Grattage Invoices (`ACCESS_DASHBOARD`) — each reusing its domain's own
  existing list query unchanged (Grattage Invoices' general query and
  Deposits' `DEPOSIT_TYPE_LABELS` were widened onto their public surfaces
  for this, the same "smallest necessary export" pattern already used
  repeatedly elsewhere; no new query, no duplicate mapper, no new
  permission). Manual QA is the explicit next task before this is
  committed — see "Next task" below.

Full write-ups for every item above: `project-status.md`'s own dedicated sections.

## Next task: M7 Overview Phase 1 — MANUAL QA (do NOT start Phase 2)

**This is the literal first thing to do next session, before anything
else — including before touching Phase 2.** Overview Phase 1 (Foundation +
decision queues) is implemented and automated-QA-clean, but **UNCOMMITTED**
pending a real-browser pass, per the working agreement's own "test the
golden path and edge cases... before reporting a feature complete" rule —
the identical discipline every prior M7 surface (Agent 360, Client 360)
already went through before its own commit.

**Sign in as Super Admin and start at `/`.**

**The checklist, in order:**

1. **Inspect the full Overview layout** — heading, the three-widget grid,
   desktop multi-column vs. mobile stacking, no horizontal overflow.
2. **Pending Cheques widget** — real pending cheques appear (reference,
   Agent identity, submitted date, amount); confirm against what
   `/money/cheques/pending` itself shows for the same data.
3. **Pending Deposits widget** — real pending deposits appear (reference,
   Agent identity, type, submitted date, amount as a real formatted
   number); cross-check against `/money/deposits?status=pending`.
4. **Overdue Grattage widget** — real overdue invoices appear (reference,
   Commercial, Client phone, due date, amount, Overdue badge); cross-check
   against `/grattage/invoices?status=overdue`.
5. **Displayed totals** — when a queue has more than 5 real rows, "Showing
   5 of N" must show the TRUE total, not a count of the 5 rendered rows;
   when 5 or fewer exist, no truncation line should appear at all.
6. **Empty/populated presentation** — if any queue is genuinely empty
   right now, confirm its own honest empty copy ("No pending cheques." /
   "No pending deposits." / "No overdue Grattage invoices.") renders, not
   an error state and not a blank gap.
7. **Navigation** — each widget's "View all" link, and each Grattage row's
   own invoice link, must land on the real existing page with the right
   filter already applied (check the URL, not just that a page loaded).
8. **Responsive behavior** — resize/narrow the viewport; confirm the grid
   stacks cleanly to one column with no overflow.
9. **Permission combinations**, as practical with available accounts —
   confirm a session missing one of `VIEW_CHEQUES`/`VIEW_DEPOSITS`/
   `ACCESS_DASHBOARD` shows exactly the other widgets, and that DevTools
   Network shows no request at all for the one that's absent.

**Outcome:**
- **Bug found** → fix it, re-verify, THEN commit.
- **Passes clean** → review the final diff, commit Phase 1 alone (do not
  bundle a Phase 2 start into the same commit), push, then update
  `next-session.md`/`project-status.md` to mark Phase 1 COMPLETE — only
  then move on to preparing Phase 2.

**Do not mark Overview Phase 1 COMPLETE before manual QA runs.** Its
current, accurate status is: **IMPLEMENTED — automated QA passed — manual
QA pending — uncommitted.**

**Future-phase decisions/open items, preserved from this session's
discovery — do not re-derive, and do not start any of these before Phase 1
is committed:**

- **Phase 2 (Statistics tiles)**: use only the source-verified metrics that
  actually answer the frozen Overview purpose (network health / cash
  movement / stock exposure / needs-attention) — do not blindly expose
  every `statistics` field merely because it exists. Specifically exclude
  `debt.*` (an internal admin-accounting figure, not a network/cash/stock
  signal) and the redundant, confusingly-named `agents.total` (duplicates
  `agents.total_active`), unless a later, explicit product decision says
  otherwise.
- **Phase 3 (Network/cash charts)**: deposits-over-time and
  agent-registration-trend charts. **No chart library exists in this
  codebase today** (verified from `package.json` in full). The charting
  approach — inline SVG vs. a new dependency — is **NOT decided**. Do not
  add a charting dependency without explicit approval and an ADR (CLAUDE.md:
  "No new dependency without justification and an ADR").
- **Phase 4 (Recent activity + agents overview)**: `recent-activities`
  returns TWO separate, independently-ordered collections (`recent_deposits`,
  `recent_payments`) — verified from source, not assumed. They must stay
  two separate collections/widgets; do not merge them into one synthetic
  chronological feed the backend does not actually provide. Top Managers
  (from `agents-overview`) may link to Agent 360 (`agentDetailPath`). Do
  not duplicate the city-breakdown data across multiple widgets — pick one
  source (this was flagged as redundant across `statistics.cities.breakdown`,
  `chart-data.agents_by_city`, and `agents-overview.agents_by_role_and_city`
  during discovery).

## Things that MUST NOT be changed without a new decision (carried, updated this session)

- 🚫 **Do not add a charting dependency for M7 Overview Phase 3 without
  explicit approval and an ADR.** No chart library exists in this codebase
  today (verified from `package.json` in full during Overview discovery) —
  the choice between inline SVG and a real dependency is an open decision,
  not a default. CLAUDE.md's own rule: "No new dependency without
  justification and an ADR."
- 🚫 **Do not start M7 Overview Phase 2 (or later) before Phase 1's own
  manual QA passes and Phase 1 is committed and pushed.** See "Next task"
  above — this is the literal next session's first action.
- 🚫 **Do not commit Overview Phase 1 without running its manual QA
  checklist first**, even though every automated gate is clean — the same
  discipline Agent 360's and Client 360's own manual-QA passes already
  required (and each found real defects automated tests could not).
- 🚫 **Do not add edit mode to the M3.6 wizard**, an agent detail page, or move
  `TextField` to `shared/`. Unchanged (ADR-0014, Rule-of-Three).
- 🚫 **Do not build a generic wizard framework.** FTA D-9. Unchanged.
- 🚫 **Do not replace the bounded manager/sector `<select>`s with an async entity
  picker** without a fresh, explicit decision.
- 🚫 **Do not give any wizard button `type="submit"`.** Unchanged — M3.6 Follow-up 5.
- 🚫 **Do not add `--success`/`--warning`/`--info` CSS custom properties** to
  `index.css` as a side effect of any future screen. `StatusBadge`'s M4.1 color
  implementation (direct Tailwind utilities) was a deliberate, scoped choice.
- 🚫 **Do not retrofit Villes/Managers/Commercials/Clients onto `DataTable`/
  `FilterBar`** as a side effect of unrelated work; that migration remains separate,
  larger, and out of scope. `EntityChip` and the URL-filter hook remain genuinely
  unextracted.
- 🚫 **Do not authorize on roles** — permission strings only (FTA D-5).
- 🚫 **Do not invent backend contracts.** Every BC-code in `project-status.md`'s
  Backend dependencies section is a standing disclosed limitation, not a problem to
  route around.
- 🚫 **Do not merge mappers, key factories, or Manager→Commercial pickers** across
  domains (ADR-0012, ADR-0021).
- 🚫 **Do not register a domain event in `invalidation-map.ts` ahead of the mutation
  that emits it.** Unchanged discipline, now with 15+ real entries.
- 🚫 **`ConfirmActionDialog` may gain new generic props, never a domain-named one**
  (ADR-0020). If a new action needs behavior it cannot express, design a new
  component — do not smuggle a business conditional into this one.
- 🚫 **Do not give any freshness-check query (`useFreshConfirm`'s `query` argument)
  the SAME cache key as its host page's own detail query.** A shared key lets a
  transient verification failure corrupt the host page's own display (ADR-0018).
  Every callsite so far (Cheques, Deposits, both Stock resources) gives its
  freshness query its own, distinct key — keep doing that.
- 🚫 **Do not build a proactive capacity/stock-quantity hint for the DEPOSIT-capacity
  or OUTSTANDING-OBLIGATION gates** (`ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY`;
  `RETURN_STOCK_INSUFFICIENT`/`TRANSFER_STOCK_INSUFFICIENT`;
  `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`, which DOES have a proactive
  frontend integration via `useGrattageRestockGateQuery`, ADR-0027, but that is
  the gate's own advisory READ, not a derived capacity NUMBER) — BC-AA is only
  PARTIALLY resolved (ADR-0025): two per-owner PRODUCT-availability reads exist now,
  but no capacity read exists, and no cross-owner ledger view exists. Allocation's
  own team-obligation gate no longer exists at all post `9af5d00` — see ADR-0029.
- 🚫 **Do not derive a new Stock resource's error codes, permission names, or
  `validation_summary`/response keys mechanically from an existing resource's own.**
  Register each one explicitly, verified fresh from its own `*ExceptionRenderer` and
  Resource class (ADR-0022) — Transfer's own codes diverged from Return's in
  specific, named ways precisely because this discipline was followed.
- 🚫 **Do not build CRUD (create/edit/delete) for Companies or Suppliers.** Both are
  seeded once (`Phase4ASeeder`) and are deliberately reference-only — a read-only
  `GET` endpoint plus a `domains/reference/*` module with no list page, mirroring
  `domains/reference/companies/` exactly, is the whole shape either one gets
  (ADR-0023).
- 🚫 **Do not reintroduce a client-supplied `allocation_number`/`transfer_number`
  input.** Both are backend-generated (`DocumentNumberService`) and both
  `StoreAllocationRequest`/`StoreAgentTransferRequest` reject the field entirely now
  (ADR-0024) — a value sent would simply be ignored.
- 🚫 **Do not swap Return's/Bons' own "add line" product picker to a stock-scoped
  endpoint as a side effect of unrelated work.** Only Allocations/Transfers use
  `useCompanyStockQuery`/`useManagerStockQuery` (ADR-0025); Return/Bons still use the
  unfiltered `useProductOptionsQuery()` by choice — changing that needs its own
  fresh decision, not an assumption of consistency.
- 🚫 **Do not re-add a proactive Grattage restock-gate integration to
  `AllocationDetailPage`, and do not build a client-side Allocation capacity
  calculation.** Backend commit `9af5d00` made the team-obligation gate
  non-authoritative for Allocation and removed the exception class entirely;
  the sole remaining gate is the reactive `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY`
  409 (ADR-0029), and the backend is the sole authority for that number
  (ADR-0032). Agent Transfer's own gate is a different, still-hard, unchanged
  contract (ADR-0028) — do not conflate the two.
- ✅ **`useGrattageOutstandingQuery` IS NOW EXPORTED** from
  `domains/grattage/outstanding/index.ts` (M7 Agent 360 Phase 3, `69f50aa`) —
  ADR-0026's own carried-forward plan, fulfilled. `AgentOutstandingPanel` is
  its real caller. This is no longer a "do not export" item; do not revert it
  back to domain-private. If Client 360 needs a Grattage read of its own,
  verify fresh whether it is CLIENT-scoped (a different backend contract —
  see "What is known" above) before assuming this same hook applies.
- 🚫 **Do not add another Stock←Grattage, Money↔Grattage, Network←Grattage,
  or Overview←Grattage domain-to-domain import** beyond the five now
  sanctioned: Stock's `AgentTransferDetailPage` importing
  `useGrattageRestockGateQuery` (ADR-0027); Deposits' own private,
  domain-local `fetchLinkedGrattageInvoices` read instead of a Grattage
  import (Option B, ADR-0030); Network's `AgentOutstandingPanel` (inside
  `network/agents`) importing `useGrattageOutstandingQuery` from
  `domains/grattage/outstanding` (M7 Agent 360, ADR-0033); Network's
  `ClientGrattagePanel` (inside `network/clients`) importing
  `useClientGrattageInvoicesQuery` from `domains/grattage/invoices` (M7
  Client 360 Phase 3, ADR-0036); and Overview's `OverdueGrattageWidget`
  (inside `domains/overview`) importing the general
  `useGrattageInvoicesQuery` from the SAME `domains/grattage/invoices`
  surface — the first edge from a domain other than Network or Stock (M7
  Overview Phase 1, ADR-0037). A new cross-domain need should default to
  Option B's private-duplicate-read pattern unless a fresh decision says
  otherwise.
- 🚫 **Do not build a proactive numeric-capacity read or UI for Allocation**
  without a new backend endpoint to back it — none exists, before or after
  `9af5d00` (BC-AA stays partially open).
- 🚫 **Do not derive Agent Edit's zero-stock Manager reassignment guard from
  `available_grattage`, the `stock` product breakdown, or anything besides
  `stock_quantity === 0`.** Verified and re-confirmed twice this milestone
  (once when `available_grattage` was added, once when `stock` was added) —
  the guard's own condition never changed. See ADR-0033.
- 🚫 **Do not calculate Available Grattage client-side** — not from
  `montant_avance_grattage`, not from Transfers/Returns, not from Deposits,
  not from Grattage Outstanding. The real formula
  (`StockService::commercialAvailableGrattage()`) is genuinely backend-owned
  business logic, the same restraint ADR-0032 already established for
  Allocation's capacity gate. Consume `available_grattage` from
  `GET /admin/agents/{agent}/stock-quantity` verbatim, as a string, never
  parsed to a number. See ADR-0033.
- 🚫 **Do not use `overflow-hidden` on `FormDrawer`'s `SheetContent`.** Use
  `overflow-clip`. This is not a style preference — `overflow-hidden` is
  still a genuine CSS scroll container per spec, and a real, live-Chrome-
  reproduced defect traced to exactly this (a focused file input inside it
  had the browser's native focus-scroll behavior hijack the container's own
  `scrollTop`, blanking the whole drawer). See `project-status.md`'s M7
  section and ADR-0034 for the full reproduction.
- 🚫 **Do not reintroduce a torn-down/rebuilt DOM structure in
  `FileUploadField`'s status-row or preview elements** (conditionally
  rendering a `<span>`/`<Button>`/`<img>`/`<a>` in and out of the tree based
  on `value`/`existingUrl`). Keep them always mounted, toggling `hidden`
  instead — a real, source-verified defect class inside any Radix `Dialog`
  (`FocusScope`'s own `MutationObserver` can yank focus on ANY DOM removal
  while focus is transiently on `document.body`, which a native file-picker
  round trip produces). See ADR-0034.

## Known follow-ups (carried, updated this session)

- [x] **M4 (Cheques, Deposits, Debt Payments) — fully DONE.** See `project-status.md`.
- [x] **Freshness-rule retrofit (`useFreshConfirm`) — DONE.**
- [x] **M5 — Stock, ALL FIVE PHASES DONE at the implementation level** (discovery,
      Agent Stock Returns, Agent Transfers, Allocations, Bons), plus the post-Bons
      stock-aware product selection + backend-generated numbers update.
- [x] **M6 — Grattage (the seam) — DONE, manual QA passed.** All four phases
      (Invoices, restock-gate domain, Stock integration, Deposit↔Invoice
      linking) plus the mid-milestone Allocation-capacity correction. See
      `project-status.md`'s own M6 section.
- [x] **M7 Agent 360 — DONE, manual QA passed.** All five phases (workspace
      foundation, full Agent Edit, Money/Stock panels, Grattage Outstanding,
      zero-stock Manager reassignment guard) plus the manual-QA finalization
      pass (`FormDrawer`/`FileUploadField` fixes, Commercial Current Stock,
      the product breakdown, Available Grattage). Includes the per-agent
      Outstanding-obligation UI view explicitly carried forward from M6.
      See `project-status.md`'s own M7 section, ADR-0033/ADR-0034.
- [x] **M7 Client 360 — DONE, manual QA passed.** All three implementation
      phases (`9cc464a`, `506e992`, `22f2ba9`) plus two manual-QA fixes
      (same-Commercial reassignment disable `55cc33d`, Agent 360 blocked-
      Grattage-capacity clarification `47ab778`) — all committed and pushed.
      See `project-status.md`'s own M7 — Client 360 section.
- [ ] **M7 Overview widget grid — Phase 1 IMPLEMENTED, automated QA passed,
      MANUAL QA PENDING, UNCOMMITTED. NEXT (immediately): manual QA, not
      Phase 2 — see "Next task" above.** Discovery is CLOSED — the prior
      backend-readiness risk is resolved (backend commit `6aa671f`, all
      four Dashboard endpoints routed on `access-dashboard`). Do not
      re-open discovery; do not start Phase 2 before Phase 1 is manually
      QA'd and committed.
- [ ] **Manager per-commercial Grattage Outstanding breakdown — accepted
      coarse capability, NOT a roadmap gap.** The frozen architecture (§6)
      names "outstanding obligation" as an Agent 360 deliverable generically,
      per agent — it does not require a Manager-side per-commercial
      breakdown. Agent 360's Manager view was deliberately scoped to a coarse
      clear/team-outstanding sentence only (zero amount, zero count, zero
      inferred commercial identity), an explicit product decision made during
      Phase 3's own approval, not a backend limitation worked around. Do not
      reopen this as a gap without a fresh, explicit product decision to
      widen it.
- [ ] **Manual browser validation owed** for Deposits, Debt Payments, Agent
      Transfers, Allocations and Bons (the M5 resources) — none has had a real
      end-to-end pass yet. Unaffected by M6/M7; all five are simply owed, none
      blocked. (M6's own resources, and all of M7 Agent 360, ARE manually
      validated.)
- [ ] **FE-1 — test flake, unchanged.** Suite is now at 1159 tests across 60
      files. Recommended before the suite grows further.
- [ ] **FE-2 — nested-route guard.** Unchanged, still non-blocking. No Stock or
      Grattage resource has needed a nested route either — every one so far
      ships flat sibling routes.
- [ ] **ESLint domain-boundary gap (raised during M6 Phase 3, still
      non-blocking, now more relevant).** `eslint.config.js` has no rule
      restricting domain-to-domain imports — only a deep-import ban and a
      `domains → app` ban exist. The frozen roadmap's own claim that the
      Stock←Grattage boundary is "verified by the boundary lint" is not
      literally true. M7 Agent 360 added a THIRD sanctioned cross-domain
      import (Network←Grattage, `AgentOutstandingPanel`, reading
      `domains/grattage/outstanding`) on top of the two that already
      existed; Client 360 Phase 3 then added a **fourth**
      (Network←Grattage, `ClientGrattagePanel`, reading
      `domains/grattage/invoices` — a genuinely different Grattage
      submodule and backend contract from Agent 360's own, so this is a
      new edge, not a reuse of the third) — exactly as this follow-up
      predicted. All four remain correct today by review discipline, not
      tooling. Worth a real lint rule now — deferred three times in a row
      (M6, M7 Agent 360, M7 Client 360), recorded as a follow-up each time
      rather than fixed as a side effect of unrelated work.
- [ ] **BC-AA — PARTIALLY resolved.** Two per-owner stock reads exist now
      (`companies/{id}/stock`, `managers/{id}/stock`, ADR-0025), feeding Allocations'/
      Transfers' own product pickers. Still no cross-owner Stock ledger view and no
      capacity read — Allocation's `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` gate and
      Transfer's `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION` gate both stay
      reactive-only. (Allocation's own team-obligation gate no longer exists at
      all, post backend commit `9af5d00` — see the M6 section.)
- [x] **BC-AB — verified, unchanged, not a gap to close.** Only Bons has a `/cancel`
      route, and Bons now has the only cancel UI — correctly absent for
      Allocations/Agent Transfers/Agent Stock Returns.
- [x] **B-1 — FULLY RESOLVED.** Both `GET /admin/companies` (M5 Phase 4) and
      `GET /admin/suppliers` (M5 Phase 5) now exist — read-only, seeded reference
      data, no CRUD, by deliberate decision (ADR-0023).
- [ ] **BC-Y, BC-X, BC-N, BC-U, BC-V, BC-S, BC-Z — raise with the backend.** Unchanged.
- [ ] **`implementation-status.md` has not been appended to since M3.1** — this
      session deliberately left it alone (a full historical backfill through M2–M5 is
      a distinct, larger task from this session's own documentation-sync scope). Flag
      to the user; do not silently attempt the backfill inside an unrelated task.
- [ ] **Rule-of-Three: cross-domain picker export (at "3") and the URL-filter-hook
      question — still the two open decision points from M3/M4.** Unaffected by M5.
- [ ] **`ApprovalQueuePage`/`DetailPage` tally now at "2"** (Cheques, Deposits) — a
      genuine third consumer would be the actual decision point; still not reached.
- [ ] Backend: `view-permissions` permission (B-6 deferred the OR-gate cleanup).
      Unchanged.
- [ ] Gate G2 formal closure — unchanged, governance only.

## Session workflow

See [`session-bootstrap.md`](session-bootstrap.md) §4 (before writing code) and §5
(before ending a session). This file is one of the artifacts §5 requires you to update.
