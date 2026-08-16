import { PanelBoundary } from "@/shared/components/patterns/panel-boundary";
import { PendingChequesWidget } from "../components/pending-cheques-widget";
import { PendingDepositsWidget } from "../components/pending-deposits-widget";
import { OverdueGrattageWidget } from "../components/overdue-grattage-widget";
import { StatisticsPanel } from "../components/statistics-panel";
import { TrendsPanel } from "../components/trends-panel";

/**
 * M7 Overview — Phase 1 (Foundation + decision queues) + Phase 2
 * (Statistics) + Phase 3 (Trends). Replaces `WelcomePlaceholder` at the
 * app shell's own index route (`/`) — see `app/router/routes.tsx`. The
 * frozen architecture's own widget-grid module (`phase8-architecture.html`
 * §5): "Built as a widget grid, not a fixed page — each stat tile, chart,
 * or queue is one widget reading one endpoint... Widget visibility
 * follows the same permission registry as the sidebar."
 *
 * DELIBERATELY NOT `WorkspacePage` — that shared shell is documented as
 * "entity header + panel area" for a SINGLE composed entity (Agent 360,
 * Client 360); Overview has no entity, no title-worthy subject, and its
 * panel area is a multi-column GRID, not `WorkspacePage`'s own vertical
 * `flex flex-col` panel stack. Reusing it here would misrepresent both
 * components' own contracts. This page is its own minimal shell instead,
 * built from the SAME generic primitives every other page already uses
 * (`PanelBoundary`, `ListLoadingState`/`ListErrorState`/`ListEmptyState`,
 * `StatusBadge`, `MoneyAmount`, `StatCard`, plain Tailwind grid/flex
 * utilities) — no new dashboard-specific design system.
 *
 * THREE SECTIONS SHIP AS OF PHASE 3 — "Statistics" (nine KPI tiles,
 * grouped Network health / Cash movement / Exposure), "Trends" (two
 * charts: Deposit Submissions, Agent Registrations — placed between
 * Statistics and Needs attention because both Statistics and Trends are
 * read-only, high-density "comparison at a glance" surfaces, Design
 * System §14, while Needs attention is the one section with actionable
 * navigation), and "Needs attention" (the three Phase 1 decision queues,
 * Pending Cheques / Pending Deposits / Overdue Grattage Invoices).
 * `recent-activities` and `agents-overview` remain explicitly OUT of
 * scope (Phase 4 — see the M7 Overview discovery report); not omitted by
 * oversight. `agents_by_city`/`deposits_by_method` were deliberately
 * EXCLUDED from Trends by product decision (the former duplicates
 * Statistics' own excluded `cities.breakdown`; the latter is an all-time
 * breakdown, not a trend) — see `TrendsPanel`'s own docblock.
 *
 * ALL THREE SECTION HEADINGS ("Statistics", "Trends", "Needs attention")
 * ARE STATIC PAGE STRUCTURE, not permission-derived — this page still
 * owns no query, no permission check, and no domain type; it never
 * imports a domain HOOK itself, only each domain's own top-level widget/
 * panel component. A section heading always renders even if every panel
 * beneath it is absent for the current session's permissions (the same
 * "page title always shows" shape the page's own "Overview" `<h1>`
 * already established) — this page has no way to know WHY a panel is
 * empty, only that the heading is a structural label, not a conditional
 * one.
 *
 * EACH PANEL/WIDGET IS AN INDEPENDENT CHILD COMPONENT — every one runs
 * its own query (in parallel — nothing here sequences them), decides its
 * own permission gate, and renders its own loading/error/empty/populated
 * branch. `PanelBoundary` wraps each one independently, so a genuine
 * render crash in one cannot blank the others — the same isolation Agent
 * 360's/Client 360's own panels already proved, now extended to Trends
 * alongside Statistics and the three Phase 1 queues.
 *
 * A panel renders NOTHING (not even its own frame) when its required
 * permission is absent — `if (!canView) return null` before its query is
 * even constructed, inside the panel itself, mirroring every existing
 * Agent 360/Client 360 panel's own "no permission, no frame, no request"
 * discipline. This page always mounts all five unconditionally and lets
 * each one opt out.
 */
export function OverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Statistics</h2>
        <PanelBoundary>
          <StatisticsPanel />
        </PanelBoundary>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Trends</h2>
        <PanelBoundary>
          <TrendsPanel />
        </PanelBoundary>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Needs attention</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PanelBoundary>
            <PendingChequesWidget />
          </PanelBoundary>
          <PanelBoundary>
            <PendingDepositsWidget />
          </PanelBoundary>
          <PanelBoundary>
            <OverdueGrattageWidget />
          </PanelBoundary>
        </div>
      </section>
    </div>
  );
}
