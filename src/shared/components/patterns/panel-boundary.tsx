import { Component, type ReactNode } from "react";

/**
 * A per-panel React error boundary (Architecture §4/§6, roadmap M7 — "one
 * dead panel must not blank the other four"), deferred from Phase 1 by
 * deliberate decision until a phase brought a SECOND real panel to isolate
 * from — Phase 2 (Money + Stock, alongside identity) is that phase.
 *
 * A CLASS COMPONENT BECAUSE IT MUST BE — React has no hook that catches a
 * render error; `getDerivedStateFromError`/`componentDidCatch` are the only
 * mechanism, and no library (`react-error-boundary` or otherwise) is a
 * dependency of this project. This is the one exception to "no class
 * components" that isn't a style choice.
 *
 * CATCHES RENDER CRASHES ONLY — `route-error-boundary.tsx`'s own documented
 * philosophy applies here too: "a boundary firing in normal operation is a
 * bug to fix, not a state to design around." Query loading/error/empty are
 * NOT this component's concern and are already isolated for free (each
 * panel's own `useQuery` renders its own branch; one panel's `isError` never
 * touches a sibling's render). This boundary exists for the different,
 * rarer failure: a genuine bug in a panel's own render code.
 *
 * PRESENTATION ONLY, same boundary every other `shared/components/patterns`
 * component holds: no telemetry call, no domain knowledge of what a "Money"
 * or "Stock" panel is — the caller decides what goes inside.
 */
type PanelBoundaryProps = {
  children: ReactNode;
};

type PanelBoundaryState = {
  hasError: boolean;
};

export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  state: PanelBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PanelBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <p role="alert" className="text-muted-foreground py-4 text-sm">
          This section could not be loaded.
        </p>
      );
    }
    return this.props.children;
  }
}
