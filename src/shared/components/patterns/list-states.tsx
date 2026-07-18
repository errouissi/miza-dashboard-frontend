import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * The three states a list occupies before it can show rows (Design System §23).
 *
 * Extracted in M2c from three byte-identical copies across Villes, Secteurs and
 * Products. They live in one file because they are one decision — "what does a
 * list render when it has no rows to render" — and splitting them into three
 * files would separate things that are always read together.
 *
 * PRESENTATION ONLY. No query, no AppError inspection, no domain type. Every
 * caller passes finished copy: what "empty" means differs per resource ("No city
 * yet" vs "No sector in this city"), and choosing between those is domain
 * knowledge that shared/ may not hold (FTA §4).
 */

/** Skeleton rows while the first page loads. Never a spinner (Design System §21). */
export function ListLoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export type ListErrorStateProps = {
  /** What failed, in the caller's words. */
  message: string;
  /**
   * The correlation reference, when the failure carries one (FTA §11). Rendered
   * between the message and the action, mirroring the route error boundary's
   * hierarchy, and OMITTED ENTIRELY when absent — a bare "Ref." with nothing
   * after it looks like a support handle and is not one.
   *
   * The caller derives it from the one normalized error shape
   * (`resolveErrorDisplay`); this component never parses an error itself.
   */
  reference?: string;
  onRetry: () => void;
  retryLabel?: string;
};

export function ListErrorState({
  message,
  reference,
  onRetry,
  retryLabel = "Retry",
}: ListErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-12">
      <p className="text-sm">{message}</p>
      {reference ? (
        <p className="text-muted-foreground font-mono text-xs">Ref. {reference}</p>
      ) : null}
      <Button variant="outline" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

/**
 * Nothing to show — which is not the same as something went wrong. The caller
 * supplies the message, because "no rows at all" and "no rows matching this
 * filter" are different facts and only the caller knows which applies.
 */
export function ListEmptyState({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-12 text-sm">{children}</p>;
}
