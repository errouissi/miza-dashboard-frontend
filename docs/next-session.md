# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-08-16_

---

## Current state

**M4 (Money), M5 (Stock, implementation level), M6 (Grattage — the seam),
and M7 (Overview & workspaces, Agent 360, Client 360) are ALL COMPLETE
and CLOSED.** Agent 360 and Client 360 are both COMPLETE, manual QA
passed, committed and pushed. The Overview widget grid — Phase 1
(`15a64fb`), Phase 2 (`263ad78`), Phase 3 (`d11e29c`) — is COMPLETE;
Phase 4 is CLOSED BY DISCOVERY/DECISION, no frontend implementation
(ADR-0040). The "is stock exposure normal" purpose-clause remains a
disclosed, non-blocking backend capability gap (BC-AE). Full M7 detail
is preserved further down this section, unchanged from its own closeout.

**M8 — Hardening ("making it trustworthy") is the current milestone.
Discovery/kickoff is COMPLETE. Implementation has NOT started.** A full
discovery pass ran across all six frozen M8 deliverables (E2E, a11y,
performance, observability, feature flags, ADR reconciliation) —
findings and approved decisions are recorded in full under "M8 discovery
— findings and approved decisions" below. **The repository was clean
before this checkpoint; nothing was implemented, installed, or
modified.** **Next task: M8 Phase 1A — Playwright foundation + isolated
E2E environment/harness.** See "Next task" below — tomorrow's session
implements Phase 1A, it does not re-discover it.

## M8 discovery — findings and approved decisions (this session, no implementation)

**Approved M8 phase structure** (supersedes the roadmap's own generic
"E2E/a11y/performance/observability/flags" ordering with a reviewed,
dependency-aware split):

1. **Phase 1A — Playwright foundation + isolated E2E environment/harness**
   — **NEXT TASK, see below.**
2. **Phase 1B — deterministic backend fixture support** (kept separate
   from 1A by explicit decision).
3. **Phase 2 — irreversible money-path E2E** (the 12-flow inventory below).
4. **Phase 3 — accessibility hardening.**
5. **Phase 4 — performance measurement/hardening.**
6. **Phase 5 — observability** (error-reporting vendor decision happens
   HERE, not earlier).
7. **Phase 6 — feature flags + ADR reconciliation + final P1 sweep.**

**Approved decisions, this session:**

1. **E2E tooling: Playwright.** Selected, not yet installed. **An ADR
   must be written when Phase 1A implementation begins** — do not skip
   this; it has not been created yet on purpose (a discovery-stage
   decision, not yet a built one).
2. **E2E environment: a dedicated, isolated E2E PostgreSQL
   environment/database — never the shared dev DB.** Irreversible
   automated E2E MUST NOT run against the same shared Postgres instance
   every manual QA session in this project's history has used. Missing
   E2E configuration MUST fail closed (refuse to run, never silently
   fall back to another DB). Real backend + real authentication required
   — **MSW-backed browser tests do NOT satisfy the M8 "real backend"
   criterion**, no matter how thorough.
3. **Phase 1A scope, approved, narrow:** minimal Playwright
   install/config; the isolated E2E environment's own safety/config
   (fail-closed if misconfigured); deterministic REAL authentication
   (real login against the real backend, not a mocked session); exactly
   ONE non-destructive smoke test (`browser → login → real Laravel
   backend → authenticated Overview`); a CI foundation ONLY if it can
   honestly run the real backend + isolated Postgres (do not fake this
   with MSW in CI). **No irreversible money operations in Phase 1A.** No
   Cheque/DebtPayment factories in Phase 1A unless strictly required
   just to authenticate for the smoke test. **Phase 1B (fixtures) stays
   separate — do not fold it into 1A.**
4. **Error-reporting vendor decision is DEFERRED to Phase 5.** Do NOT
   install Sentry or any other vendor during Phase 1A (or 1B/2/3/4).
   Backend ticket **B-4** (correlation-ID echo) remains the known,
   already-tracked backend dependency for when Phase 5 starts — the
   frontend's own half (generating and displaying `X-Request-Id`) is
   already built and live, confirmed this session.
5. **P1 working definition, approved:** *"A P1 is a defect reachable in
   a shipped, permission-granted production flow that can: corrupt
   authoritative financial, stock, allocation, or debt data; expose
   protected data belonging to another operator/user; or prevent
   completion of a critical irreversible operation with no viable
   workaround."* Do NOT automatically classify dormant architecture gaps,
   backend capability gaps, testability gaps, feature requests, or known
   non-blocking flakes (FE-1) as P1 under this definition.

**The verified 12 irreversible-flow inventory (Phase 2's own scope,
preserved in full so it never needs rediscovering):**

| # | Flow | Route | Mutation hook | Permission | Confirmation | Unit/integration coverage |
|---|---|---|---|---|---|---|
| 1 | Cheque Approve | `/money/cheques/:id` | `useApproveChequeMutation` | `approve-cheque` | `ConfirmActionDialog` | 43 tests (shared file) |
| 2 | Cheque Reject | `/money/cheques/:id` | `useRejectChequeMutation` | `reject-cheque` | `ConfirmActionDialog` | (same file) |
| 3 | Cheque Annuler | `/money/cheques/:id` | `useAnnulerChequeMutation` | `annuler-cheque` | `ConfirmActionDialog` | (same file) |
| 4 | Deposit Validate | `/money/deposits/:id` | `useValidateDepositMutation` | `validate-depo` | `ConfirmActionDialog` | 46 tests (shared file) |
| 5 | Deposit Reject | `/money/deposits/:id` | `useRejectDepositMutation` | `reject-depo` | `ConfirmActionDialog` | (same file) |
| 6 | Debt Payment Create | `/money/debt-payments` | `useCreateDebtPaymentMutation` | `debt_cash` | none (direct submit) | 16 tests |
| 7 | Agent Stock Return Validate | `/stock/returns/:id` | `useValidateAgentStockReturnMutation` | (Return's own) | `ConfirmActionDialog` | 23 tests |
| 8 | Agent Transfer Validate | `/stock/transfers/:id` | `useValidateAgentTransferMutation` | (Transfer's own) | `ConfirmActionDialog`, Grattage restock gate | 29 tests |
| 9 | Allocation Validate | `/stock/allocations/:id` | `useValidateAllocationMutation` | `validate-allocation` | `ConfirmActionDialog`, deposit-capacity gate | 25 tests |
| 10 | Bon Validate | `/stock/bons/:id` | `useValidateBonMutation` | `validate-bon` | `ConfirmActionDialog` | 27 tests (shared file) |
| 11 | Bon Cancel | `/stock/bons/:id` | `useCancelBonMutation` | `cancel-bon` | `ConfirmActionDialog` (reason required) | (same file) |
| 12 | Grattage Invoice Cancel | `/grattage/invoices/:id` | `useCancelGrattageInvoiceMutation` | `access-dashboard` | `ConfirmActionDialog` | 25 tests |

All 12 currently have **zero real-backend E2E coverage** (confirmed —
E2E infrastructure is completely greenfield, see below). Rows 4–11
overlap exactly with the standing M5 owed-manual-validation follow-up
(Deposits, Debt Payments, Agent Transfers, Allocations, Bons) — **Phase
2's own E2E coverage, flow by flow, closes that debt as it lands**; it
is the same underlying obligation, not a second one. Rows 1–3 (Cheques)
and 7 (Agent Stock Return) are the two flows already manually validated
outside E2E.

**Other discovery findings that must survive this session:**

- **E2E infrastructure is completely greenfield** — zero Playwright/
  Cypress/browser tooling anywhere in `package.json`/lockfile, no
  `e2e/` directory, no CI job capable of starting a browser or the real
  backend (`.github/workflows/ci.yml` today only runs lint/typecheck/
  Vitest/build).
- **Shared dev PostgreSQL is unsafe for repeatable irreversible E2E** —
  every one of the 12 flows above permanently mutates state with no undo;
  running them against the same DB every manual QA session has used
  would exhaust or corrupt the existing seeded fixtures.
- **Deterministic fixture gaps exist** — backend has factories for
  Agent/Client/Deposit/AgentTransfer/AgentStockReturn/Allocation/Bon/
  GrattageInvoice/Company/Supplier/Ville/User, but **no factory exists
  for Cheque or DebtPayment** — needed before Phase 2 can seed those two
  flows deterministically (this is Phase 1B's own concern, not 1A's).
- **Accessibility — two confirmed M8 exit-criteria blockers**: zero
  `prefers-reduced-motion` support anywhere in the codebase; Overview's
  two Phase-3 chart components (`deposit-submissions-chart.tsx`,
  `agent-registrations-chart.tsx`) render each data bar as an SVG
  `<rect>` with no `tabIndex`, so individual bar tooltips are
  mouse-hover-only — keyboard/screen-reader users get only the chart's
  own top-level label, never a single bar's real value. One strong
  positive: all 12 money/stock confirmation dialogs above use
  `ConfirmActionDialog` uniformly (ADR-0020), inheriting Radix's
  focus-trap/Escape-to-close for free — no P1-severity a11y defect found
  on any irreversible flow itself.
- **Performance measurement currently depends on browser/E2E tooling** —
  no `performance.mark`/web-vitals/Lighthouse CI exists; "time to
  populated table per domain" cannot be measured until Phase 1A's own
  tooling exists to measure it with. No accidental serial waterfalls
  found — every sequential-looking query pattern already verified as
  deliberate (ADR-0025's own dependent-query pattern; Agent 360/Client
  360 blocking child panels only on their own required parent id).
  Bundle: 933.87 KB (262.41 KB gzip), unchanged since M7 Phase 3, still
  over Vite's 500KB warning.
- **Observability**: the frontend ALREADY sends `X-Request-Id`
  (`infrastructure/http/correlation.ts`) and both error boundaries
  already surface it as a "Ref. {id}" support reference in the UI — this
  half is live, not greenfield. **Backend ticket B-4 (already tracked
  via `BC-E`) still prevents true end-to-end correlation** — the backend
  does not echo/log the header today. No toast system, no console
  logging in production code, no error-reporting SDK, no PII-leak
  surface found (nothing exists yet that could serialize PII into a
  report — the risk is entirely prospective, for Phase 5 to handle
  correctly when it adds a real reporting call).
- **Feature flags — zero expired flags found.** Exactly three exist
  (`config.features.environmentBanner/devtools/errorReporting`, per
  CLAUDE.md's own mandated pattern); `environmentBanner` is consumed
  (`app-shell.tsx`), `devtools`/`errorReporting` are declared and tested
  for their own computed value but have **no consumer anywhere yet** —
  this is deliberate forward-looking scaffolding for Phase 5/6 to wire
  up, not dead code to remove.
- **Boundary suppressions — zero found**, freshly re-verified (not
  reused from M7's own result). All 13 `eslint-disable` comments in
  `src/` are `react-hooks/exhaustive-deps`, none touch
  `no-restricted-imports` or any domain-boundary rule. The M8 exit
  criterion ("zero boundary suppressions without an ADR") is currently
  met trivially.
- **ADR reconciliation found zero source contradictions** across all 40
  ADRs. Three pre-existing, already-known follow-ups remain owed
  (ADR-0008's own deferred formal-promotion revisit; ADR-0014's detail
  pages, blocked by FE-2; ADR-0016's "all-pages" bulk-assign step) — none
  newly discovered, none stale.
- **P1 baseline**: this project has NEVER had a P1/P0/P2 taxonomy before
  this session — the working definition above (approved decision 5) is
  the first one. Under it, no open P1 was found: the four 🔴-marked
  BC-codes (BC-N ×2, BC-A, BC-G) are backend-gap/testability issues, not
  reachable production defects; FE-2 (nested-route guard) is a real but
  currently-dormant architectural gap, unexercised because no nested
  route has been built.

## M7 closure (historical, unchanged from its own closeout)

- **Overview discovery is CLOSED.** The backend blocker disclosed by the
  frozen roadmap (`chartData`/`recentActivities`/`agentsOverview` possibly
  unrouted) is resolved: backend commit `6aa671f` on branch
  `feature/Update-claude` routed all three, alongside the pre-existing
  `GET /admin/dashboard/statistics`. **All four Dashboard endpoints are now
  routed, all four gated on `access-dashboard` alone, and there is no
  remaining blocking backend gap.** Full verification (exact contracts,
  response shapes, permission matrix, widget mapping, phase plan) is in the
  M7 Overview discovery report from that session — not re-copied here in
  full; re-read it before Phase 2 if the detail is needed again.
- **Overview implementation is split into four phases** (re-planned from
  verified source, not the earlier tentative A/B split): **Phase 1 —
  Foundation + decision queues (Pending Cheques, Pending Deposits, Overdue
  Grattage Invoices) — COMPLETE, manual QA passed, committed `15a64fb`.
  Phase 2 — Statistics (Network health / Cash movement / Exposure) —
  COMPLETE, manual QA passed, committed `263ad78`. Phase 3 — Trends
  (Deposit Submissions, Agent Registrations) — COMPLETE, manual QA passed,
  committed `d11e29c`. Phase 4 — CLOSED BY DISCOVERY/DECISION (ADR-0040),
  no frontend implementation.** Recent Deposits, Recent Payments, Top
  Managers, and a city breakdown were each evaluated against the frozen
  Overview purpose and Phases 1–3's own already-delivered signals, and
  explicitly excluded — none was silently skipped. The "is stock exposure
  normal" purpose-clause stays a disclosed, non-blocking backend
  capability gap (BC-AE) — see `project-status.md`'s own M7 Overview
  section and ADR-0040 for the full reasoning behind every exclusion.
- **Phase 1's exact file list, as committed in `15a64fb`:**
  - `src/domains/overview/` (new) — `pages/overview-page.tsx` +
    its own test file, `components/pending-cheques-widget.tsx`,
    `components/pending-deposits-widget.tsx`,
    `components/overdue-grattage-widget.tsx`, `index.ts`.
  - `src/app/router/routes.tsx` (modified) — the index route (`/`) now
    renders `OverviewPage` instead of `WelcomePlaceholder`.
  - `src/app/router/app-shell.test.tsx` (modified) — the one assertion
    that checked the old placeholder's heading.
  - `src/app/placeholders.tsx` (DELETED) — `WelcomePlaceholder`, no
    longer referenced anywhere (verified by grep at closeout — no dead
    references remain).
  - `src/domains/grattage/invoices/index.ts` (modified) — widened to
    export the already-existing `useGrattageInvoicesQuery`/
    `GRATTAGE_INVOICE_LIST_DEFAULTS`/`GrattageInvoiceListParams`
    (Overdue Grattage widget's own read — no new query, no duplicate
    mapper).
  - `src/domains/money/deposits/index.ts` (modified) — widened to export
    the already-existing `DEPOSIT_TYPE_LABELS` (Pending Deposits
    widget's own type label).
- **Phase 2's exact file list, as committed in `263ad78`:**
  - `src/domains/overview/model/dashboard-statistics.ts` (new) — the
    narrow `DashboardStatistics` model, grouped `networkHealth`/
    `cashMovement`/`exposure` (exactly the nine approved metrics).
  - `src/domains/overview/api/dashboard-statistics-api.ts` (new) —
    `fetchDashboardStatistics`, mapping only the nine approved wire
    fields, plus `normalizeAggregateDecimal` (see the decimal-zero
    finding below).
  - `src/domains/overview/queries/keys.ts` (new) — the flat
    `dashboardStatisticsKeys.all` factory (no params — one global read).
  - `src/domains/overview/queries/dashboard-statistics-queries.ts` (new)
    — `useDashboardStatisticsQuery`, `SLOW` tier, `enabled` option for
    the same outer-gate pattern.
  - `src/domains/overview/components/statistics-panel.tsx` (new) —
    `StatisticsPanel` (outer gate on `ACCESS_DASHBOARD`) +
    `StatisticsContent` (loading/error/success, three `StatGroup`s).
  - `src/shared/components/business/stat-card.tsx` (new) — the
    design-system-specified KPI tile, first real caller.
  - `src/domains/overview/pages/overview-page.tsx` (modified) — added
    the `Statistics`/`Needs attention` page-level section headings and
    mounted `StatisticsPanel` in its own `PanelBoundary`.
  - `src/domains/overview/pages/overview-page.test.tsx` (modified) —
    Statistics panel behavior, permission combinations, and isolation
    coverage added alongside the existing Phase 1 widget tests.
- **A real backend representation inconsistency was found and normalized
  during Phase 2 implementation, verified LIVE against the running dev
  database, not assumed from source alone**: `total_solde`/`total_cash`
  are raw SQL `SUM()` aggregates (`Agent.solde`/`Agent.cash`, both
  `decimal:2`), and Laravel's query-builder `sum()` never casts its raw
  driver return — pgsql returns a non-empty aggregate as a STRING
  (confirmed live: `"total_solde":"500.00"`), but `sum()`'s own body is
  `return $result ?: 0`, so a SQL `SUM()` over ZERO rows returns `NULL`,
  which is falsy, yielding a literal JSON INTEGER `0` instead of `"0.00"`
  (confirmed live on a sibling `sum()` field, `debt.total_paid`, on an
  empty table). `normalizeAggregateDecimal` (in
  `dashboard-statistics-api.ts`) corrects ONLY this representation gap: a
  string is returned untouched; a numeric `0` becomes `"0.00"`; any OTHER
  non-zero number THROWS rather than being silently formatted — no
  `Number()`/`parseFloat()`, no float reconstruction, ever. See ADR-0038.
- **Phase 3's exact file list, as committed in `d11e29c`:**
  - `src/domains/overview/model/dashboard-chart-data.ts` (new) — narrow
    model, exactly the two approved series (`depositSubmissions`,
    `agentRegistrations`); `agents_by_city`/`deposits_by_method` are
    deliberately excluded (the former duplicates Statistics' own excluded
    `cities.breakdown`; the latter is an all-time breakdown, not a trend).
  - `src/domains/overview/api/dashboard-chart-data-api.ts` (new) —
    `fetchDashboardChartData(days)`, plus client-side zero-fill for chart
    continuity (see below) — no zero-fallback normalization needed here
    (see the correction below, unlike Phase 2's `total_solde`/`total_cash`).
  - `src/domains/overview/queries/keys.ts` (modified) — widened with
    `dashboardChartDataKeys.detail(days)` (parameterized, unlike
    Statistics' flat key).
  - `src/domains/overview/queries/dashboard-chart-data-queries.ts` (new)
    — `useDashboardChartDataQuery(days = 30)`, `SLOW` tier.
  - `src/domains/overview/components/deposit-submissions-chart.tsx` (new)
    — small, purpose-built SVG bar chart, no dependency.
  - `src/domains/overview/components/agent-registrations-chart.tsx` (new)
    — small, purpose-built SVG grouped-bar chart, no dependency, with a
    role legend.
  - `src/domains/overview/components/trends-panel.tsx` (new) —
    `TrendsPanel` (outer gate on `ACCESS_DASHBOARD`) + `TrendsContent`
    (loading/error/success, per-series honest empty state).
  - `src/domains/overview/pages/overview-page.tsx` (modified) — added
    the "Trends" page-level section heading, between Statistics and
    Needs attention, and mounted `TrendsPanel` in its own `PanelBoundary`.
  - `src/domains/overview/pages/overview-page.test.tsx` (modified) —
    Trends panel behavior, permission combinations, and isolation
    coverage added alongside the existing Phase 1/2 tests.
  - `docs/decisions.md` (modified, append-only) — ADR-0039.
- **A correction to a concern raised during Phase 2's own closeout, found
  during Phase 3 discovery and re-verified live**: `next-session.md` had
  flagged that `chart-data.deposits_over_time.total_amount` "carries the
  same `SUM(amount)` aggregate shape that turned out to need
  normalization" (ADR-0038's own concern). Tracing `chartData()`'s actual
  query construction shows this does NOT apply — `deposits_over_time`
  comes from a `GROUP BY` query (`->select(...)->groupBy(...)->get()`),
  not `Illuminate\Database\Query\Builder::sum()`; a `GROUP BY` query never
  emits a row for an empty group at all (confirmed live: a day with zero
  deposits produces no array entry), so `total_amount` is never the bare
  JSON integer `0` ADR-0038 found for a standalone `sum()` call — there is
  structurally no fallback case to normalize for this series.
- **Deposit Submissions is honestly scoped and labeled, not assumed
  to mean confirmed cash**: `chartData()`'s own query has no `status`
  filter and no `type` filter — pending, validated AND rejected deposits,
  of both `rapped` and `grattage` types, are summed together. The chart
  is titled "Deposit Submissions — Last 30 Days", never "collected cash"/
  "validated deposits"/"settled cash"/"confirmed cash movement" — see
  `deposit-submissions-chart.tsx`'s own docblock.
- **Zero-fill is client-side visualization shaping only, never a
  fabricated backend record**: the backend omits a day/role with zero
  rows entirely (confirmed live). `dashboard-chart-data-api.ts` generates
  a continuous `[today-29 .. today]` window, inserting
  `{count: 0, totalAmount: "0.00", isZeroFilled: true}` for missing days
  — `isZeroFilled` distinguishes a generated point from a real backend
  row (tested, including the "genuine real `0.00` row vs. generated
  zero-fill" distinction). Agent Registrations zero-fills per
  `(date, role)` only for roles OBSERVED in the real response — never a
  hardcoded `["manager", "commercial"]` set. If the ENTIRE backend series
  is empty, `TrendsPanel` shows the honest empty-state copy instead of 30
  visually-zero bars (`hasData`, computed from the real row count,
  independent of the zero-filled array).
- **Financial decimal safety mirrors ADR-0038's own boundary**:
  `totalAmount` stays a `string` through the model/mapper/query layers,
  rendered verbatim in every tooltip/label. `Number(totalAmount)` is
  called ONLY inside each chart's own local geometry function (bar
  height), never stored, never reused for display — pinned by a
  dedicated test (`"1500.10"` must render with its trailing zero intact;
  a naive `Number().toString()` round-trip would silently produce
  `"1500.1"`).
- **No chart dependency was added — ADR-0039.** Verified before
  implementation: zero chart libraries/SVG primitives existed anywhere in
  this codebase, the production bundle was already flagged by Vite for
  exceeding 500KB (928KB pre-Phase-3), and `@radix-ui/react-tooltip`
  already existed as a dependency with a working `Tooltip` primitive
  (previously used only by the sidebar) — reused for both charts' own
  tooltips. Both chart components are small, explicit, and kept
  DOMAIN-LOCAL (`domains/overview/components/`), not promoted to
  `shared/business/` — two callers inside the SAME domain does not meet
  CLAUDE.md's "three independent domains" promotion bar `StatCard`
  itself cleared. Build confirms no dependency was pulled in: bundle grew
  928.66 KB → 933.87 KB (+5KB), not the tens-to-hundreds of KB a chart
  library would add.
- **`agents_by_city` was excluded by explicit product decision, not
  discovered-and-forgotten**: verified as a byte-for-byte duplicate query
  of `statistics.cities.breakdown` (already excluded from Phase 2 for the
  identical reason) — rendering it in Phase 3 would have been the exact
  redundant second city-data visualization that exclusion exists to
  prevent. `deposits_by_method` was also excluded — an all-time method
  breakdown, not a trend, out of this chart phase's own scope.
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
- **Manual QA passed, real running backend, Super Admin session**: layout,
  each widget's populated/empty state cross-checked against its own
  dedicated page, every "View all" link verified to land on the correct
  URL with the correct filter active, Grattage row links verified,
  displayed totals correct, responsive behavior passed, permission
  combinations confirmed (absent-permission widgets fire zero requests),
  console/network sanity clean, no unexpected 401/403. See
  `project-status.md`'s own "M7 — Overview" section for the full write-up.
- **Final verification at closeout**: 601/601 focused tests (Overview,
  Cheques, Deposits, Grattage Invoices, Agent 360, Client 360, app-shell);
  full suite run three times — clean at 1269/1269 twice, one run hit the
  pre-existing FE-1 flake on the same untouched `bons-list-page.test.tsx`
  timing test, which passed clean standalone and clean on the third
  full-suite run, confirming the flake rather than a regression; `tsc -b`/
  `eslint .` (0 errors, 4 pre-existing unrelated `react-hooks/
  incompatible-library` warnings in Money/Stock create forms, not
  Overview)/`prettier --check .` all clean; `vite build` succeeds.
- **FE-1 (test flake) is unchanged, still present, still non-blocking** —
  same untouched `bons-list-page.test.tsx` timing test as above. Not
  caused by Overview Phase 1.
- **Phase 2 manual QA passed, real running backend, Super Admin session**:
  Statistics visual hierarchy (Network health / Cash movement / Exposure,
  clearly grouped, not an undifferentiated wall of cards), all nine
  metrics rendering correctly, `Total Solde`/`Total Cash` matching the
  real backend decimal values exactly (`500.00`/`0.00` — the zero case
  confirming `normalizeAggregateDecimal`'s own fallback live, not only in
  a test fixture), `Needs attention` remaining visually separate and
  usable, responsive/mobile behavior (no horizontal overflow, no broken
  card layout), and Phase 1's three widgets unaffected.
- **Phase 2 final verification at closeout**: 53/53 focused Overview
  Phase 2 tests; 569/569 regression (Cheques, Deposits, Grattage Invoices,
  Agent 360, Client 360); a clean full-suite run at 1290/1290 across 64
  files; `tsc -b`/`eslint .` (0 errors, same 4 pre-existing unrelated
  warnings)/`prettier --check .` all clean; `vite build` succeeds.
- **Phase 3 manual QA passed, real running backend, Super Admin session**:
  Statistics cards (unaffected), Deposit Submissions chart, Agent
  Registrations chart, both tooltips, desktop layout, responsive/mobile
  layout, Needs attention (unaffected), no regressions found.
- **Phase 3 final verification, implementation session**: 82/82 focused
  Overview tests (Phases 1+2+3 combined); 569/569 regression (one
  interleaved run hit widespread system-load timing failures — an
  immediate clean rerun confirmed 569/569 with no code changed between
  runs, not a real regression); a clean full-suite run at 1319/1319
  across 66 files; `tsc -b`/`eslint .` (0 errors, same 4 pre-existing
  unrelated warnings)/`prettier --check .` all clean; `vite build`
  succeeds (bundle 928.66 KB → 933.87 KB, confirming no dependency was
  added).
- **Tests: 1237/1237 across 61 files** was the count BEFORE Overview
  Phase 1; **1269/1269 across 62 files** after Phase 1; **1290/1290 across
  64 files** after Phase 2, committed; **1319/1319 across 66 files** is
  the count WITH Phase 3, still uncommitted.
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
git status                 # expect: clean
git log --oneline -8        # expect this M8-discovery checkpoint commit,
                            # then 153edfb, dc0c37f, d11e29c, 5ae7ef2,
                            # 263ad78, 3bca8ab, 15a64fb
pnpm test:ci               # expect: 1319/1319 across 66 files (no source
                            # changed today — M8 discovery/checkpoint is
                            # documentation-only)
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

**This is a fresh source/git freshness check, required before Phase 1A
implementation starts** — confirm the above still matches before writing
any code. **M7 is closed. M8 discovery is complete. Do not resume
Overview Phase 4 work. Implement M8 Phase 1A only** — see "Next task"
below for its exact, narrow scope.

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
- **M7 Overview Phase 1 — Foundation + decision queues** — `15a64fb`.
  COMPLETE, manual QA passed against the real running backend (see
  "Current state" above for the exact file list and the permission-gating
  bug found and fixed during implementation). `/` now renders
  `OverviewPage` (replacing `WelcomePlaceholder`, deleted, no dead
  references) with three independently-permission-gated,
  independently-`PanelBoundary`-wrapped decision-queue widgets — Pending
  Cheques (`VIEW_CHEQUES`), Pending Deposits (`VIEW_DEPOSITS`), Overdue
  Grattage Invoices (`ACCESS_DASHBOARD`) — each reusing its domain's own
  existing list query unchanged (Grattage Invoices' general query and
  Deposits' `DEPOSIT_TYPE_LABELS` were widened onto their public surfaces
  for this, the same "smallest necessary export" pattern already used
  repeatedly elsewhere; no new query, no duplicate mapper, no new
  permission). See `project-status.md`'s own "M7 — Overview" section for
  the full write-up.
- **M7 Overview Phase 2 — Statistics** — `263ad78`. COMPLETE, manual QA
  passed against the real running backend, including responsive/mobile
  behavior (see "Current state" above for the exact file list and the
  `total_solde`/`total_cash` decimal-normalization finding). Nine
  headline metrics from ONE `GET /admin/dashboard/statistics` read,
  gated on `ACCESS_DASHBOARD` alone, grouped Network health (Active
  Commercials/Managers, Blocked Agents, Active Cities) / Cash movement
  (Deposits — Last 7 Days/This Month/Last Month) / Exposure (Total
  Solde, Total Cash) — `StatCard` (`shared/components/business/`) is the
  design-system-specified KPI tile, built at this, its first real
  caller. `SLOW` (5 min) stale time; no invalidation-map entry (no
  mutation touches this read). Independently `PanelBoundary`-isolated
  from Phase 1's three widgets, both directions. See `project-status.md`'s
  own "M7 — Overview" section for the full write-up and ADR-0038 for the
  decimal-normalization decision.
- **M8 discovery/kickoff — docs-only checkpoint, no source changes.**
  Full discovery pass across all six frozen M8 deliverables (E2E,
  accessibility, performance, observability, feature flags, ADR
  reconciliation) — see "M8 discovery — findings and approved decisions"
  above for the complete findings, the approved 7-phase structure, the
  12-flow irreversible-money inventory, and all five approved decisions
  (Playwright selected; dedicated isolated E2E Postgres environment,
  fail-closed; Phase 1A's exact narrow scope; error-reporting vendor
  deferred to Phase 5; the project's first-ever P1 working definition).
  Repository was clean before and after this pass — nothing implemented,
  installed, or modified. **Next: M8 Phase 1A.**
- **M7 closure — Overview Phase 4 discovery/decision (ADR-0040), docs
  only, no source changes.** Re-verified `recentActivities()`/
  `agentsOverview()` fresh from source and live against the running dev
  database. Confirmed M7 Overview's own frozen deliverable ("KPI tiles,
  queues, charts") was already fully satisfied by Phases 1–3 and closed
  the milestone without building against either endpoint. Recorded four
  explicit exclusions (Recent Deposits, Recent Payments, Top Managers,
  city breakdown) and the stock-exposure backend capability gap (BC-AE)
  — see `project-status.md`'s own M7 — Overview section for the full
  write-up. **M7 is now CLOSED; M8 — Hardening is the next milestone,
  not yet started.**
- **M7 Overview Phase 3 — Trends** — `d11e29c`. COMPLETE, manual QA
  passed (see "Current state" above for the exact file list, the
  ADR-0038-concern correction, the honest "Deposit Submissions" labeling,
  the client-side zero-fill discipline, and the financial decimal-safety
  boundary). Two small, purpose-built SVG charts from ONE
  `GET /admin/dashboard/chart-data?days=30` read, gated on
  `ACCESS_DASHBOARD` alone: Deposit Submissions (single-series bar,
  zero-filled continuous 30-day window) and Agent Registrations (grouped
  bar by role, legend, roles derived only from what the backend actually
  returned). `agents_by_city`/`deposits_by_method` deliberately excluded.
  No new dependency (ADR-0039) — both charts stay domain-local
  (`domains/overview/components/`), reusing the existing `Tooltip`
  primitive and the frozen design system's own Teal/Plum data-viz colors
  via direct hex (mirroring `StatusBadge`'s own precedent). See
  `project-status.md`'s own "M7 — Overview" section for the full write-up
  once it is added at commit time.

Full write-ups for every item above: `project-status.md`'s own dedicated sections.

## Next task: M8 Phase 1A — Playwright foundation + isolated E2E environment/harness

**M7 is CLOSED. M8 discovery/kickoff is COMPLETE** (see "M8 discovery —
findings and approved decisions" above for the full findings, the
approved 7-phase structure, the 12-flow inventory, and all five approved
decisions). **Nothing has been implemented yet — Phase 1A is next.**

**Before writing any code, do a brief source/git freshness check** —
confirm `git status`/`git log` still match this file's own expectations
(see "Before anything else" below) and that nothing changed underneath
this checkpoint since it was written, the same discipline every prior
session-start in this project has required.

**Phase 1A's approved scope, exactly (do not expand it):**
- Minimal Playwright install + config.
- The isolated E2E environment's own safety/config — a dedicated
  Postgres database/environment, separate from the shared dev DB used by
  every manual QA session so far. **Missing E2E configuration must fail
  closed** (refuse to run, never silently fall back to the shared DB).
- Deterministic REAL authentication — a real login against the real
  Laravel backend, not a mocked session. MSW does not satisfy this.
- Exactly ONE non-destructive smoke test: `browser → login → real
  Laravel backend → authenticated Overview`.
- A CI foundation ONLY if it can honestly start the real backend +
  isolated Postgres — do not fake this with MSW in CI.
- **Write the Playwright-tooling ADR as part of this phase** (approved
  decision 1 — the decision was made this session, the ADR was
  deliberately deferred to implementation time).

**Explicitly OUT of scope for Phase 1A:**
- No irreversible money operations, no Phase 2 flows.
- No Cheque/DebtPayment factories unless strictly required just to
  authenticate for the one smoke test — real fixture work is Phase 1B's
  job, kept deliberately separate.
- No error-reporting vendor install (Sentry or otherwise) — deferred to
  Phase 5.
- No accessibility/performance/feature-flag work — later phases.

**Roadmap framing, for context** (not Phase-1A-specific, restated from
the roadmap verbatim): *"Not a phase for finishing features. A phase for
proving the finished ones deserve an operator's trust."* Full M8
deliverables/exit criteria are unchanged from the roadmap and were
already restated faithfully during M7's own closeout — see this file's
git history or `phase8-frontend-implementation-roadmap.html` directly if
the verbatim list is needed again.

## Things that MUST NOT be changed without a new decision (carried, updated this session)

- 🚫 **Do not run irreversible automated E2E against the shared dev
  PostgreSQL database.** Approved decision this session: a dedicated,
  isolated E2E environment/database is required; missing E2E config MUST
  fail closed, never silently fall back to the shared DB. This applies
  from Phase 1A onward, not only once Phase 2 (money-path E2E) starts.
- 🚫 **Do not treat an MSW-backed browser test as satisfying the M8
  "real backend" E2E criterion.** Approved this session — real backend,
  real authentication, required for every E2E test this milestone counts
  toward its exit criteria.
- 🚫 **Do not fold Phase 1B (deterministic backend fixtures, incl.
  Cheque/DebtPayment factories) into Phase 1A.** Kept deliberately
  separate by approved decision — Phase 1A's own scope is foundation +
  one smoke test only.
- 🚫 **Do not install Sentry or any other error-reporting vendor before
  Phase 5.** Approved decision: the vendor choice is deferred, not
  skipped — do not default to installing one "while we're in the area"
  during Phase 1A/1B/2/3/4.
- 🚫 **Do not skip writing the Playwright ADR once Phase 1A
  implementation begins.** The tooling decision (Playwright) was made
  during discovery, deliberately WITHOUT an ADR yet — the ADR is due at
  implementation time, not before, and not skipped entirely.
- 🚫 **Do not classify a dormant architecture gap, backend capability
  gap, testability gap, feature request, or known non-blocking flake
  (FE-1) as a P1 defect.** Use the approved working definition (see "M8
  discovery" above) — a P1 is reachable-in-production AND causes data
  corruption, cross-operator data exposure, or blocks a critical
  irreversible operation with no workaround. Nothing found so far meets
  this bar.
- 🚫 **Do not add a charting dependency for M7 Overview Phase 3 without
  explicit approval and an ADR.** No chart library exists in this codebase
  today (verified from `package.json` in full during Overview discovery) —
  the choice between inline SVG and a real dependency is an open decision,
  not a default. CLAUDE.md's own rule: "No new dependency without
  justification and an ADR."
- 🚫 **Do not add a Recent Deposits, Recent Payments, Top Managers, or
  city-breakdown widget to Overview without a fresh, explicit decision
  superseding ADR-0040.** M7 Overview Phase 4 was discovered and
  deliberately closed without building against `recent-activities`/
  `agents-overview` — each candidate was evaluated on its own merits and
  excluded for a specific, verified reason (ADR-0040), not skipped for
  lack of time. Re-adding any of them later needs the same discovery
  discipline that closed them, not an assumption that "the endpoint
  already exists" is reason enough.
- 🚫 **Do not derive or approximate a stock-exposure figure client-side.**
  The frozen Overview purpose's "is stock exposure normal" question has
  no backing Dashboard endpoint (BC-AE, ADR-0040) — this is a disclosed,
  non-blocking gap, not something to paper over with a computed number
  from Grattage/Stock data already available elsewhere in the product.
  The same restraint ADR-0032/ADR-0033/ADR-0038 already established for
  every other backend-owned figure applies here: no number is more
  honest than an invented one.
- 🚫 **Do not re-derive `total_solde`/`total_cash` (or any future
  `SUM()`-aggregate dashboard field) through `Number()`/`parseFloat()` or
  any other floating-point reconstruction.** `normalizeAggregateDecimal`
  (`dashboard-statistics-api.ts`) fixes ONLY the wire's own zero-fallback
  representation gap (a numeric `0` → `"0.00"`) — a non-zero value is
  returned untouched, verbatim, and an unexpected non-zero NUMBER throws
  rather than being silently formatted. See ADR-0038.
- 🚫 **Do not add a `dashboard-statistics`/`dashboard-chart-data` entry to
  `invalidation-map.ts` without a real mutation to justify it.** No
  mutation anywhere in the product writes `Agent.solde`/`Agent.cash`/
  deposit counts/agent registrations in a way either read needs to react
  to instantly — `SLOW` (5 min) staleness is the approved, sufficient
  freshness guarantee for both. Adding speculative invalidation ahead of
  a real mutation would violate the same discipline
  `invalidation-map.ts`'s own docblock already states for every other
  event.
- 🚫 **Do not label the Deposit Submissions chart (or any future surface
  built on `chart-data.deposits_over_time`) as "collected cash",
  "validated deposits", "settled cash", or "confirmed cash movement".**
  `DashboardController::chartData()`'s own query has no `status`/`type`
  filter — pending, validated AND rejected deposits, of both `rapped` and
  `grattage` types, are summed together. It is submission ACTIVITY, not
  confirmed cash. See `deposit-submissions-chart.tsx`'s own docblock.
- 🚫 **Do not add `agents_by_city`/`deposits_by_method` to Trends (or
  anywhere else) without a fresh, explicit decision.** `agents_by_city`
  is a byte-for-byte duplicate of `statistics.cities.breakdown` (already
  excluded from Phase 2); `deposits_by_method` is an all-time breakdown,
  not a trend. Both were deliberately excluded from Phase 3.
- 🚫 **Do not fabricate a backend record when zero-filling a chart
  series.** `dashboard-chart-data-api.ts`'s zero-fill is visualization
  shaping only — a generated day/role point is flagged `isZeroFilled:
  true` and never written back as if it were real data. Do not zero-fill
  a role that was never observed in the actual backend response (Agent
  Registrations' `roles` comes only from what the response contained).
- 🚫 **Do not add a chart dependency for any future Overview surface
  without a fresh, explicit decision and ADR — ADR-0039 settled Phase 3's
  own case, not the general one.** Both Trends charts are small,
  purpose-built, domain-local SVG components; extend that same pattern by
  default unless a real requirement (zoom, pan, brush, a genuinely
  arbitrary dataset, a third+ chart type) proves it insufficient.
- 🚫 **Do not promote `deposit-submissions-chart.tsx`/
  `agent-registrations-chart.tsx` (or a generalized chart primitive) to
  `shared/business/` without a genuine third, independent-domain caller.**
  Two callers inside the SAME domain (Overview) does not meet CLAUDE.md's
  "three independent domains" promotion bar — see ADR-0039.
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

- [x] **M8 discovery/kickoff — COMPLETE.** All six frozen deliverables
      audited, 7-phase structure approved, 12-flow inventory recorded,
      five decisions approved (Playwright; dedicated isolated E2E
      Postgres, fail-closed; Phase 1A's narrow scope; error-reporting
      vendor deferred to Phase 5; P1 working definition). See "M8
      discovery" above.
- [ ] **M8 Phase 1A — NOT started. NEXT TASK.** Playwright foundation +
      isolated E2E environment/harness + one non-destructive smoke test
      + the Playwright ADR. See "Next task" above for the exact,
      approved, narrow scope.
- [ ] **M8 Phase 1B and later (fixtures, money-path E2E, a11y,
      performance, observability, flags/ADR/P1 sweep) — NOT started,
      NOT scoped in detail yet.** Each gets its own discovery/review pass
      before implementation, the same discipline every phase in this
      project has required.
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
- [x] **M7 Overview widget grid — Phase 1 COMPLETE, manual QA passed,
      committed and pushed (`15a64fb`).** Discovery is CLOSED — the prior
      backend-readiness risk is resolved (backend commit `6aa671f`, all
      four Dashboard endpoints routed on `access-dashboard`).
- [x] **M7 Overview widget grid — Phase 2 (Statistics) COMPLETE, manual QA
      passed (including responsive/mobile), committed and pushed
      (`263ad78`).** Nine metrics, one `ACCESS_DASHBOARD`-gated query,
      `SLOW` tier, no speculative invalidation, `StatCard`'s first real
      caller. See `project-status.md`'s own M7 — Overview section and
      ADR-0038.
- [x] **M7 Overview widget grid — Phase 3 (Trends) COMPLETE, manual QA
      passed (Statistics cards, both charts, both tooltips, desktop,
      responsive/mobile, Needs attention, no regressions), committed and
      pushed (`d11e29c`).** Two small, purpose-built SVG charts (Deposit
      Submissions, Agent Registrations), no chart dependency (ADR-0039),
      client-side zero-fill for continuity only, decimal safety mirroring
      ADR-0038. `agents_by_city`/`deposits_by_method` deliberately
      excluded. See "Current state" above for the full file list and
      findings.
- [x] **M7 Overview widget grid — Phase 4 CLOSED BY DISCOVERY/DECISION,
      no frontend implementation (ADR-0040).** Recent Deposits, Recent
      Payments, Top Managers, and a city breakdown were each evaluated
      against the frozen Overview purpose and Phases 1–3's own delivered
      signals, and explicitly excluded — see `project-status.md`'s own
      M7 — Overview section and ADR-0040 for the full reasoning behind
      every exclusion. **M7 Overview is fully COMPLETE.**
- [x] **M7 — full milestone — CLOSED.** Agent 360, Client 360, and the
      Overview widget grid (Phases 1–3 delivered, Phase 4 closed by
      decision) are all done. M7's own frozen exit criteria (zero
      boundary-lint suppressions, verified parallel panel firing,
      independent panel-crash isolation) are all met. **M8 — Hardening is
      the next milestone, not yet started — see "Next task" above.**
- [ ] **Stock exposure snapshot — genuine, disclosed, NON-BLOCKING
      backend capability gap (BC-AE, ADR-0040).** The frozen Overview
      purpose's own "is stock exposure normal" question has no backing
      Dashboard endpoint — none of `statistics`/`chart-data`/
      `recent-activities`/`agents-overview` expose a Grattage/Stock
      exposure snapshot. Phase 1's Overdue Grattage Invoices queue is a
      decision SIGNAL, not a health snapshot. Do NOT derive or
      approximate this client-side — closing it needs a future backend
      capability that does not exist today. Not a reason to withhold M7
      closure; recorded here so it isn't silently forgotten.
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
