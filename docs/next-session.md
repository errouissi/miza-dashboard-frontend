# Next Session

**Read this file first.** It is written so a session with no prior context can resume
immediately. Overwrite it at the end of every session.

_Last updated: 2026-08-09_

---

## Current state

**M4 (Money) is COMPLETE. M5 (Stock) is COMPLETE at the implementation level.
M6 (Grattage — the seam) is COMPLETE, manual QA passed. M7 (Overview &
workspaces, Agent 360, Client 360) is the current milestone — Agent 360, its
first of three composed surfaces, is now COMPLETE, manual QA passed. Client
360 is next — see "Next task" below for why, over the Overview widget grid.**

- **Code**: everything through the M7 Agent 360 manual-QA finalization pass is
  committed (`bc54e55`) and, after this documentation pass, pushed. Working
  tree is clean.
- **Tests**: 1159/1159 across 60 files. `pnpm lint`/`pnpm typecheck`/`pnpm format:check`/
  `pnpm build` all clean, re-verified this session.
- **Manual validation**: Cheques' full workflow, Agent Stock Returns, all of M6
  (Grattage Invoices, the restock-gate integration, Deposit↔Invoice linking,
  including the corrected Allocation capacity scenario), and now all of Agent
  360 (scrolling, file/photo replacement, existing previews, Commercial
  Current Stock, the product breakdown, Available Grattage, Stock-Return-
  triggered refresh, the zero-stock reassignment guard, and reassignment
  succeeding once stock reaches zero) are manually validated against the real
  running backend. **Deposits, Debt Payments, Agent Transfers, Allocations and
  Bons (the M5 resources) still have NOT had a manual browser pass of their
  own** — unaffected by M6/M7, still simply owed, none blocked.
- **M7 Agent 360 shipped, five phases plus a finalization pass**: workspace
  foundation (`c392a7e`); full role-aware Agent Edit, `manager_id`
  temporarily excluded pending a backend read (`21c6e05`); Money/Stock
  workspace panels (`2ff0d5a`); the Grattage Outstanding panel, the first
  real caller of `useGrattageOutstandingQuery` (`69f50aa`, fulfilling
  ADR-0026); the zero-stock Manager reassignment guard, closing the one
  genuine gap the completion review found against the frozen architecture's
  own named workflow (`1aa1d66`); and a manual-QA finalization pass fixing
  two real `FormDrawer`/`FileUploadField` defects and adding Commercial
  Current Stock, the product breakdown, and Available Grattage — all three
  reusing the SAME widened stock-quantity read, not a new query (`bc54e55`).
  See `project-status.md`'s own "M7 — Agent 360" section for the full
  write-up and `decisions.md` ADR-0033/ADR-0034 for the permanent decisions.
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

## Before anything else

```bash
cd C:\Miza\frontend-v2
git status                 # expect: clean
git log --oneline -3        # expect this doc-sync commit at HEAD, bc54e55 below it
pnpm test:ci               # expect: 1159/1159 across 60 files
pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```

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
- **M7 documentation-sync** — this session's own doc-sync commit. M7 Agent
  360 is now fully complete, manual QA passed.

Full write-ups for every item above: `project-status.md`'s own dedicated sections.

## Next task: M7 — Client 360

**Do a fresh discovery pass first — do not begin implementation.** Per the same
discipline every M4/M5/M6/M7-Agent-360 phase applied (ADR-0022): re-read the
relevant controllers, resources, models and permission registrations directly
from source before proposing any scope — do not assume anything from the
frozen roadmap's own prose, and do not assume Agent 360's own panel/permission
shape transfers unchanged (Client 360's own workflow is genuinely narrower —
see below).

**Why Client 360, not the Overview widget grid, is next — reasoned from the
frozen documents, not assumed:**

- The frozen roadmap groups Agent 360, Client 360 and the Overview widget grid
  as M7's three deliverables with **no mandated internal order** between them —
  all three share the same stated dependency ("M3–M6, all complete"), already
  satisfied.
- **Client 360's own dependency footprint is the smallest of the two remaining
  items.** The frozen architecture names it as Network + Grattage only (§6) —
  two domains, both complete, both already proven safe to compose from inside
  a `WorkspacePage` by Agent 360 itself. The Overview widget grid reads across
  all five domains' own stats/queue/chart endpoints.
- **The Overview widget grid carries a real, still-unverified backend-readiness
  risk the frozen roadmap discloses itself**: "the Overview's chart/activity
  endpoints were unrouted at discovery. If the M0 ticket has not landed,
  Overview ships with the widgets whose endpoints exist and flags the rest."
  Starting there means the FIRST task is re-discovering whether that routing
  ticket ever landed — a materially bigger unknown than Client 360's fully
  specified, already-satisfied dependency set.
- **The `WorkspacePage` pattern is now proven, not merely designed** — Agent
  360 already exercises independent panel error boundaries, parallel query
  firing, and page-level composition (mechanism 1, FTA §4) against real panels.
  Client 360 is the pattern's second, and simpler, application while that
  discipline is freshest — not a second invention.

**If this reasoning is rejected and Overview is chosen instead**, the same
discovery-first discipline applies: re-verify from source whether the M0
routing ticket for Overview's own endpoints landed before proposing any widget
scope, per the roadmap's own disclosed risk above.

**What is known and safe to reuse, verify-don't-assume:**

- `useFreshConfirm`/`ConfirmActionDialog` — reuse for any new irreversible
  actions, same discipline every domain so far has applied (ADR-0018, ADR-0020).
- The error-code registry, permission registry, invalidation map — register every
  new code/permission/event explicitly from its own source, never derived from
  another domain's own (ADR-0022).
- **`WorkspacePage`/`PanelBoundary` are now a real, exercised pattern**, not a
  first attempt — Agent 360's own `AgentWorkspacePage`/panel components are the
  reference implementation. Client 360 should follow the same shape (page-level
  composition, mechanism 1) unless a fresh discovery finds a genuine reason to
  diverge — do not assume identical panels/permissions without re-verifying
  Client 360's own backend contract from source.
- **Grattage's per-CLIENT purchase-history shape has not been verified.**
  `useGrattageOutstandingQuery`/`useGrattageRestockGateQuery` are both keyed
  and scoped by `agentId` (a Commercial) — Client 360 needs whatever Grattage
  read is scoped by `clientId` instead, which has NOT been discovered yet. Do
  not assume the existing Outstanding hooks apply to a client without
  re-verifying the backend contract fresh.
- **Stock imports exactly one thing from Grattage: the restock-gate hook**
  (`useGrattageRestockGateQuery`, consumed only by `AgentTransferDetailPage`) —
  this is a review-discipline boundary, NOT enforced by the ESLint config (see
  the follow-up below). Do not build a two-way coupling, and do not assume the
  lint would catch one if it happened.
- M6 and M7 Agent 360 were both **prerequisites for Client 360** and are both
  now complete — nothing blocks starting its own discovery pass.

## Things that MUST NOT be changed without a new decision (carried, updated this session)

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
- 🚫 **Do not add a second Stock←Grattage, Money↔Grattage, or Network←Grattage
  domain-to-domain import** beyond the three now sanctioned: Stock's
  `AgentTransferDetailPage` importing `useGrattageRestockGateQuery`
  (ADR-0027); Deposits' own private, domain-local
  `fetchLinkedGrattageInvoices` read instead of a Grattage import (Option B,
  ADR-0030); and Network's `AgentOutstandingPanel` (inside
  `network/agents`) importing `useGrattageOutstandingQuery` (M7 Agent 360
  Phase 3, ADR-0033 — mechanism 2, FTA §4, the same public-hook-import
  pattern as the first). A new cross-domain need should default to Option
  B's private-duplicate-read pattern unless a fresh decision says otherwise.
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
- [ ] **M7 Client 360 — NEXT.** Fresh discovery pass required before any
      implementation (see "Next task" above) — Network + Grattage only, per
      the frozen architecture; do not assume Agent 360's own panel/permission
      shape or Outstanding hooks transfer unchanged without re-verifying
      Client 360's own backend contract from source.
- [ ] **M7 Overview widget grid — not started.** Carries a disclosed,
      still-unverified backend-readiness risk (chart/activity endpoints
      possibly still unrouted) — re-verify from source before scoping if this
      is picked up instead of/after Client 360.
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
      import (Network←Grattage, `AgentOutstandingPanel`) on top of the two
      that already existed — all three remain correct today by review
      discipline, not tooling, exactly as this follow-up predicted. Worth a
      real lint rule before Client 360 potentially adds a fourth — not
      attempted in M6 or M7 Agent 360 (deliberately deferred both times,
      recorded as a follow-up rather than fixed as a side effect).
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
