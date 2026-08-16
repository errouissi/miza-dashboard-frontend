# Future Stock Module — Discovery & Direction (not scheduled)

**Status: FUTURE WORK. Not part of the active milestone. Not implemented.**
This document persists a completed discovery pass and the approved
direction that came out of it, so neither is lost when the session that
produced them ends. It is a planning record, not a task list for the
current session — **do not treat anything in this file as authorized
implementation work** without a fresh session explicitly picking it up.

**M8 (Hardening) is the current milestone, unaffected by this document.**
See `docs/next-session.md` for the actual next task
(**M8 Phase 1A — Playwright foundation + isolated E2E environment/harness**).
This file does not change that.

_Discovery performed: 2026-08-16. No application code, backend code, or
dependency was touched during discovery — read-only source inspection
only, across both `C:\Miza\frontend-v2` and `C:\Miza\backend`._

---

## 1. Why this exists

A Super Admin wants a future "Stock" menu item showing current stock,
stock health, and stock movement history, with an authoritative
operational picture — not frontend-derived guesses. A discovery pass
(read-only, backend + frontend source, no live browser needed) found
that the hard part of this feature — a correct, atomic, audited stock
ledger — **already exists and is operationally proven** in the backend.
This is fundamentally a **read-surface** project on top of existing
domain logic, not a from-scratch stock system.

## 2. Verified domain facts (do not re-derive these from scratch)

- **`stocks`** is the authoritative CURRENT balance table — keyed
  `(owner_type, owner_id, product_id)` → `quantity` (int,
  `CHECK quantity >= 0`), atomically upserted, never derived by summing
  movements at read time.
- **`stock_movements`** is the APPEND-ONLY physical audit ledger — every
  real stock movement, DB-hardened with CHECK constraints (positive
  quantity, coherent from/to endpoints, per-type shape rules).
- **`StockService`** (`app/Services/StockService.php`, backend) is the
  SOLE canonical writer — `validateBon`, `cancelBon`, `validateAllocation`,
  `validateTransfer`, `validateReturn`, `validateSale` are the only
  sanctioned stock-write entry points, each transactional and locked. No
  competing write path was found.
- **Real stock holders, verified**: **Company** (`owner_type='company'`),
  **Manager** and **Commercial** (both `owner_type='agent'`, the SAME
  polymorphic type, distinguished only by which Agent id). **Client
  NEVER materializes a stock row** — confirmed from source docblock
  ("client never materialises a stocks row" — a sale is a one-sided debit
  against the commercial only).
- **Supplier → Company intake IS a real, already-modeled physical
  movement — through validated Bons.** Every validated Bon produces a
  `supplier_ingress` `stock_movements` row (DB-shape-enforced:
  `from_type='supplier'`, `to_type='company'`, anchored to `bon_id`).
  `stocks.owner_type` also permits `'supplier'` at the schema level (added
  "for symmetry" ahead of a possible future supplier-return flow) — **but
  no code path writes or reads a Supplier stock balance today.** A
  dedicated Supplier stock balance is NOT a real, populated capability
  and must never be presented as one.
- **`GrattageSale`/Grattage client sales ARE real physical movements**,
  not merely financial records — confirmed `SalesService::createSale()`
  calls `StockService::validateSale()` directly, genuinely debiting the
  commercial's product stock.
- **Existing owner-scoped current-stock APIs already exist** (all gated
  `access-dashboard`, all returning the identical 5-field row shape
  `{product_id, name, operator, value, available_quantity}` from one call
  to `StockService::listOwnerStock($ownerType, $ownerId)`):
  - `GET /admin/companies/{company}/stock` (`CompanyController::stock()`)
  - `GET /admin/managers/{manager}/stock` (`AgentController::stock()`)
  - `GET /admin/agents/{agent}/stock-quantity` (`AgentController::stockQuantity()`,
    Commercial-only, also carries `available_grattage` — a Grattage
    monetary-capacity figure, NOT part of the physical stock ledger; do
    not conflate the two)
- **No global, cross-holder aggregate stock API exists.** Each of the
  three reads above is scoped to one owner id at a time — there is no
  "all Managers" or "company-wide totals" endpoint today.
- **No Admin-facing stock-movements API exists.** A working PRECEDENT
  exists, but on the Agent-mobile side only: `GET /agent/stock/movements`
  (`App\Http\Controllers\Api\V1\Agent\StockController::movements()`) —
  paginated, newest-first, computes `direction` ('in'/'out'), and returns
  a `document` block with `bon_id`/`allocation_id`/`transfer_id`/
  `return_id`/`invoice_id` — confirming every movement row IS already
  linkable to its real source record. This is the shape a future Admin
  equivalent should mirror, scoped by admin-supplied filters instead of
  "only my own agent."
- **No low-stock/reorder threshold concept exists anywhere** — exhaustive
  search across all migrations and models found zero `threshold`/
  `reorder`/`min_quantity`/`low_stock`/`alert` columns.
- **Movement-source navigation targets already exist for every movement
  type** — `/admin/bons/{id}`, `/admin/allocations/{id}`,
  `/admin/agent-transfers/{id}`, `/admin/agent-stock-returns/{id}`,
  `/admin/grattage-invoices/{id}` are all real, already-built admin pages
  a future Movements table could link straight to. No new detail page
  would be needed for any movement row.
- **No application code, backend code, or dependency was changed during
  this discovery** — confirmed via `git status` on both repos before and
  after.

## 3. Approved future direction

### 3.1 Module shape

```
Stock
  Overview
  Inventory
  Movements
```

### 3.2 Overview — initial authoritative metrics

- **Total Units**
- **Total Stock Value**
- **Out of Stock Products**

**Low Stock is explicitly EXCLUDED from the initial Overview** — no
authoritative threshold model exists (see §3.6). Do not ship a fake
"Low Stock" tile backed by an invented frontend threshold.

### 3.3 Inventory — cross-holder aggregation from the start

The operational question this view must answer: **"How much physical
stock do we currently have for each product, and where is it
distributed?"**

For each product, the future read model must expose in ONE response:
- operator
- product / denomination
- Company-held quantity
- Manager-held quantity
- Commercial-held quantity
- total physical quantity
- total face value

**This must be a single authoritative backend aggregate read — NOT
reconstructed by the frontend firing N+1 requests to every individual
holder.** The backend owns this aggregation; the frontend consumes one
finished shape.

### 3.4 Stock Value — the only approved definition

**`product denomination/value × authoritative physical quantity`.**

- Do NOT use transaction `unit_cost` as a current-stock valuation —
  verified inconsistent across movement types (`allocation_lines.unit_cost`
  is NOT NULL and load-bearing for a deposit-capacity gate;
  `bon_lines.unit_cost` is nullable and explicitly documented backend-side
  as "metadata only, no business gate reads it"). It answers "what did
  this specific transaction cost," never "what is this stock worth now."
- Do NOT invent a purchase-cost/profit valuation — no authoritative
  source for either exists anywhere in the domain.

### 3.5 Movements

Must read the real `stock_movements` ledger and support exactly the
verified physical paths (§2), including reversals
(`supplier_ingress_reversal`, `client_sale_reversal`). Each row retains
its real source reference and navigates to the already-existing
corresponding detail page (§2's own navigation-target list) — never a
new, invented detail page.

### 3.6 Low Stock — deliberately unresolved

**Confirmed current state**: no threshold exists; **Out of Stock CAN be
authoritative today** (`quantity == 0`); **Low Stock CANNOT** be
authoritative until a threshold model is built.

**Preferred future direction**: a backend-configurable, per-product
reorder/low-stock threshold (not a fixed frontend constant, not a single
global backend constant — both were considered and rejected as
misrepresenting different products' real risk profiles).

**Still unresolved, deliberately not decided today**:
- Who configures the threshold (which role, which screen)?
- Is the threshold global per product, or does it vary by Company?

Do not implement a frontend-hardcoded threshold. Do not silently pick an
answer to either open question above without a real product decision.

### 3.7 Supplier

Supplier → Company intake is already real, via validated Bons (§2). A
dedicated Supplier stock BALANCE is not a real, populated capability and
must not be exposed as one. Supplier-scoped MOVEMENT HISTORY (a
`?supplier_id=` filter on the future movements endpoint) may be added
later if product requirements genuinely need it — not assumed necessary
from the start.

### 3.8 Relationship to BC-AE

BC-AE (recorded in `docs/project-status.md`'s own M7 — Overview section
and `docs/decisions.md`'s ADR-0040) is the standing, disclosed,
non-blocking gap that no Dashboard endpoint answers "is stock exposure
normal." **This future Stock read model is the natural authoritative
capability that would eventually close it** — a small, dedicated
stock-health summary (e.g. `total_units`, `total_value`,
`out_of_stock_count`, and `low_stock_count` only once §3.6 is resolved)
consumed by Overview as its own narrow read, the same pattern Statistics/
Trends already use (a purpose-built summary, never the full Stock page
reconstructed). **This is a recorded direction only — Overview itself is
NOT changed by this document, and closing BC-AE needs its own fresh
discovery/decision pass when it's actually picked up (§4, Phase 6).**

## 4. Provisional future implementation sequence

Provisional only — each phase needs its own review before implementation,
the same discipline every milestone in this project has required so far.

- **Stock Phase 1** — Backend: authoritative aggregate inventory read +
  Admin movements read API (see §5 for the conceptual shape). No
  migration expected — the schema already supports this.
- **Stock Phase 2** — Frontend: Stock Overview + Inventory, following
  this project's own established domain patterns (list pages, `StatCard`,
  `PanelBoundary`).
- **Stock Phase 3** — Frontend: Movement History, filterable, linking to
  each movement's real existing source detail page.
- **Stock Phase 4** — Low-stock threshold model/configuration — ONLY
  after the business decisions in §3.6 are made. Expected to need a real
  migration and a new admin write surface (out of scope until decided).
- **Stock Phase 5** — Optional Supplier-specific movement UX, only if
  still required after Phase 3 ships.
- **Stock Phase 6** — BC-AE / Overview stock-health integration, after
  its own separate, fresh discovery/decision pass.

## 5. Required future backend read APIs (conceptual — not a locked contract)

Persisted as direction only. **Exact request/response contracts,
permissions, filters, and pagination need a fresh implementation
discovery before any code is written** — do not treat the shapes below
as final.

- **`GET /admin/stock`** — authoritative aggregate inventory + totals
  (Overview's three metrics, Inventory's cross-holder-per-product rows).
  Conceptually reuses `StockService::listOwnerStock()`'s existing logic,
  extended to aggregate across owners rather than one owner at a time.
- **`GET /admin/stock/movements`** — paginated Admin movement history,
  admin-appropriate filters (owner type/id, product, movement type,
  status, date range — note: **no existing movement-source endpoint
  currently supports a date-range filter**, this would be new). Mirrors
  the already-working Agent-mobile `StockController::movements()` shape,
  without the "only my own agent" restriction.

Do not make a future frontend reconstruct the global stock picture from
many owner-scoped endpoint calls — both of the above must exist as real,
purpose-built, backend-aggregated reads before frontend work starts.

## 6. Unresolved business decisions (do not resolve without explicit product input)

1. Low-stock threshold ownership — who configures it, and does it vary
   by Company or stay global per product (§3.6).
2. Whether cross-holder aggregation (§3.3) should ship with a
   per-holder drill-down in the same Phase 1, or a later addition.
3. Whether a dedicated Supplier movement view is wanted at all, or
   whether Bons' own existing list already satisfies that need (§3.7).
4. Whether this becomes its own future milestone (M9-class) or folds
   into a later phase of an existing one — explicitly not decided here.

## 7. Explicit non-goals (do not do these without a fresh decision)

- Do not implement any part of this module now.
- Do not add a Low Stock tile backed by a frontend-invented threshold.
- Do not use `unit_cost` as a stock valuation.
- Do not invent purchase-cost/profit tracking.
- Do not expose a Supplier stock BALANCE as if it were real.
- Do not reconstruct the global inventory picture via N+1 frontend
  requests to owner-scoped endpoints.
- Do not treat this document as authorization to start Stock work in a
  session where the active task is something else (currently: M8 Phase
  1A — see `docs/next-session.md`).
