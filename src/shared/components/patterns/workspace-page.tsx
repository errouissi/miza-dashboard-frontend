import type { ReactNode } from "react";

/**
 * The frame a cross-domain workspace renders inside (Architecture §4/§6, FTA
 * §4 — mechanism 1, "composition at the page"). The FIFTH shared page
 * pattern, declared by the frozen architecture itself (Architecture §4's own
 * layout table lists it alongside `ListPage`/`DetailPage`/`DraftLifecyclePage`)
 * — a known-shared pattern by specification, not a discovery promoted after
 * three callers (the exception FTA §12 itself carves out for the declared §7
 * library and §4 patterns).
 *
 * First built for Agent 360 (roadmap M7, Phase 1); Client 360 (a later M7
 * phase) is its second, planned consumer.
 *
 * ENTITY HEADER + PANEL AREA, AND NOTHING ELSE. Mirrors `ListPage`'s own
 * restraint exactly: no query, no permission check, no domain type. The
 * caller decides what `status`/`facts`/`actions` contain — "may this operator
 * block this agent" is a permission question, and shared/ holds no
 * authorization logic (FTA §4).
 *
 * PANELS ARE THE CALLER'S OWN CHILDREN, NOT A PROP THIS SHELL ENUMERATES.
 * Mechanism 1 states it precisely: "the composing page owns the layout; each
 * panel remains owned by its domain; no domain learns about another." This
 * shell never imports a domain hook itself — it has no idea Money, Stock or
 * Grattage panels exist. Each panel is an ordinary child component that runs
 * its own query and renders its own loading/error branch, exactly like every
 * existing DetailPage's own sections already do (`AllocationDetailPage`'s
 * "Processed" section, `GrattageInvoiceDetailPage`'s facts grid) — that
 * pattern already gives independent panels for free: one panel's query error
 * only ever affects that panel's own render branch, never a sibling's.
 *
 * NO REACT ERROR-BOUNDARY-PER-PANEL YET, BY DELIBERATE DEFERRAL (M7 Phase 1
 * discovery pass, discussed with and accepted by the product owner). The
 * roadmap's own exit criterion ("one dead panel must not blank the other
 * four") is about a REAL render crash propagating past its own panel, a
 * different mechanism from a query failure (already isolated, see above) —
 * and `route-error-boundary.tsx`'s own documented philosophy applies here
 * too: "a boundary firing in normal operation is a bug to fix, not a state to
 * design around." Building a crash-isolation wrapper against Phase 1's ONE
 * panel would have nothing to isolate FROM yet and would be exactly the
 * "abstraction fitted to an imagined caller" FTA D-11/ADR-0008 already
 * reject. Add it at the phase that brings a SECOND real panel (Phase 2,
 * Money) — the first phase this becomes a testable property, not an assumed
 * one. Each panel already being a separate child component (not this shell's
 * own concern to enumerate) means wrapping one later needs no redesign here.
 */
export type WorkspacePageProps = {
  title: string;
  /** Rendered beside the title — typically a `StatusBadge`. Omitted entirely when absent. */
  status?: ReactNode;
  /** A key-facts row below the header, before the panel area. Omitted entirely when absent. */
  facts?: ReactNode;
  /**
   * The action row, beside the title (mirrors `ListPage.action`'s own
   * placement). A flex container so a later action (Phase 1.5's Edit) can be
   * added alongside Block/Activate without restructuring this shell or its
   * caller's own layout.
   */
  actions?: ReactNode;
  /** The panel area: one or more domain-owned panels, laid out by the caller. */
  children: ReactNode;
};

export function WorkspacePage({
  title,
  status,
  facts,
  actions,
  children,
}: WorkspacePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          {status}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {facts}

      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
