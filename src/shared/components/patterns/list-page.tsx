import type { ReactNode } from "react";

/**
 * The frame every list screen renders inside (Design System §2, §5).
 *
 * Extracted in M2c from three screens whose outer structure was identical:
 * a title row with an optional primary action, an optional filter row, and the
 * list body below.
 *
 * IT DOES NOT OWN THE TABLE, and that is the load-bearing constraint. The three
 * screens' bodies are not alike: Villes renders sortable headers and a pager,
 * Secteurs a plain table with a resolved relation column, Products a money
 * column. A shell that rendered rows would have to express all three, which is
 * the paginated-DataTable abstraction M2c deliberately does NOT build (1 of 3
 * evidence). Content arrives as `children`; the shell never looks inside it.
 *
 * Nor does it own state. No query, no filter parsing, no permission check — the
 * caller decides whether `action` is present, because "may this operator create
 * one" is a permission question and shared/ holds no authorization logic.
 *
 * What it owns is spacing and hierarchy, which is exactly the part that was
 * copied verbatim three times.
 */
export type ListPageProps = {
  title: string;
  /**
   * The primary action, typically a create button. Pass `null` to omit it —
   * the caller gates on permission, not this component.
   */
  action?: ReactNode;
  /** The filter row. Omitted entirely when absent, so no empty band renders. */
  filters?: ReactNode;
  /** The list body: a table, a state component, whatever the screen needs. */
  children: ReactNode;
  /** Below the body — pagination on the screens that have it. */
  footer?: ReactNode;
};

export function ListPage({ title, action, filters, children, footer }: ListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {action}
      </div>

      {filters ? <div className="flex items-center gap-2">{filters}</div> : null}

      {children}

      {footer}
    </div>
  );
}
