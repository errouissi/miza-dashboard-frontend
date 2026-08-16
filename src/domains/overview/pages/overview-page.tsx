import { PanelBoundary } from "@/shared/components/patterns/panel-boundary";
import { PendingChequesWidget } from "../components/pending-cheques-widget";
import { PendingDepositsWidget } from "../components/pending-deposits-widget";
import { OverdueGrattageWidget } from "../components/overdue-grattage-widget";

/**
 * M7 Overview — Phase 1 (Foundation + decision queues). Replaces
 * `WelcomePlaceholder` at the app shell's own index route (`/`) — see
 * `app/router/routes.tsx`. The frozen architecture's own widget-grid
 * module (`phase8-architecture.html` §5): "Built as a widget grid, not a
 * fixed page — each stat tile, chart, or queue is one widget reading one
 * endpoint... Widget visibility follows the same permission registry as
 * the sidebar."
 *
 * DELIBERATELY NOT `WorkspacePage` — that shared shell is documented as
 * "entity header + panel area" for a SINGLE composed entity (Agent 360,
 * Client 360); Overview has no entity, no title-worthy subject, and its
 * panel area is a multi-column GRID, not `WorkspacePage`'s own vertical
 * `flex flex-col` panel stack. Reusing it here would misrepresent both
 * components' own contracts. This page is its own minimal shell instead,
 * built from the SAME generic primitives every other page already uses
 * (`PanelBoundary`, `ListLoadingState`/`ListErrorState`/`ListEmptyState`,
 * `StatusBadge`, `MoneyAmount`, plain Tailwind grid/flex utilities) — no
 * new dashboard-specific design system.
 *
 * ONLY THE THREE HIGHEST-VALUE DECISION QUEUES SHIP THIS PHASE (Pending
 * Cheques, Pending Deposits, Overdue Grattage Invoices) — Dashboard
 * statistics, chart-data, recent-activities and agents-overview are
 * explicitly OUT of scope for Phase 1 (see the M7 Overview discovery
 * report); they are later, separately-reviewed phases, not omitted by
 * oversight.
 *
 * EACH WIDGET IS AN INDEPENDENT CHILD COMPONENT — this page owns no query,
 * no permission check, and no domain type; it never imports a domain HOOK
 * itself, only each domain's own top-level widget component. Every widget
 * runs its own query (in parallel — nothing here sequences them), decides
 * its own permission gate, and renders its own loading/error/empty/
 * populated branch, exactly like every other composed workspace's own
 * panels already do. `PanelBoundary` wraps each one independently, so a
 * genuine render crash in one widget cannot blank the other two — the
 * same isolation Agent 360's Phase 2 and Client 360 already proved, now a
 * THIRD composed surface exercising the identical pattern.
 *
 * A widget renders NOTHING (not even its own frame) when its required
 * permission is absent — `if (!canView) return null` before its query is
 * even constructed, inside the widget itself, mirroring every existing
 * Agent 360/Client 360 panel's own "no permission, no frame, no request"
 * discipline. This page always mounts all three unconditionally and lets
 * each one opt out; it holds no permission logic of its own. A session
 * holding none of `view-cheques`/`view-depos`/`access-dashboard` still
 * sees a well-formed page — the "Overview" heading and an otherwise-empty
 * grid, never a broken or blank shell — the same "page title always
 * shows, panels are what disappear" shape `WorkspacePage` already
 * established for Agent 360/Client 360.
 */
export function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Overview</h1>

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
    </div>
  );
}
