import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * The paginated-list table shell (Architecture §7, FTA §12), extracted at
 * M4.2 from FOUR working screens — Villes, Managers, Commercials, Clients —
 * whose `<table>` markup was byte-for-byte identical apart from column
 * count and content: `overflow-x-auto` wrapper, `w-full text-sm` table,
 * `border-b text-left` header row, `p-2 font-medium` header cells
 * (`text-right` for numeric columns), `border-b` body rows, `p-2` body
 * cells (`text-right tabular-nums` for numeric columns). This is that
 * shape, generalized — not invented ahead of evidence (ADR-0006's
 * Rule-of-Three was already met at M3.4; this is the first caller to
 * actually draw on it).
 *
 * HEADLESS ON PURPOSE. `DataTable` owns structure only — not loading,
 * error or empty states (those stay `ListLoadingState`/`ListErrorState`/
 * `ListEmptyState`, rendered as siblings by the caller, exactly as every
 * existing list page already does), not pagination (stays the caller's
 * `ListPage` `footer`, per Villes' own precedent: "no shared pager is
 * extracted... 1-of-3 evidence" — still true), and not sorting (only
 * Villes has real sort today; baking sort-toggle machinery in for a single
 * caller would be exactly the speculative abstraction ADR-0006 warns
 * against). A column's `header` is a plain `ReactNode`, so a future
 * caller CAN render a sortable button there without this component
 * knowing anything about sorting.
 *
 * `cell` IS A RENDER FUNCTION, not a field accessor. An actions column
 * (buttons, permission-gated) is not a special case DataTable needs to
 * know about — it is just a column whose `cell` returns buttons, the same
 * way every existing table already renders its own actions column.
 *
 * `align: "right"` couples `text-right` (header) with `text-right
 * tabular-nums` (cells) — verified from source as the one pairing every
 * existing numeric column actually uses; no existing column is
 * right-aligned without also being tabular-nums, or vice versa.
 */
export type DataTableColumn<T> = {
  /** Stable identity for the column — used as the React key, not displayed. */
  key: string;
  /** Rendered in the header cell. */
  header: ReactNode;
  /** Rendered per row, in this column's body cell. */
  cell: (row: T) => ReactNode;
  /** Right-aligns the header and applies `tabular-nums` to the cells — the numeric-column convention. Omit for left-aligned (the default). */
  align?: "right";
  /** Extra className on both the header and body cells — e.g. a fixed width for an actions column. */
  className?: string;
  /** `<th scope="col">`'s visible content, when different from a screen-reader-only header (mirrors every existing actions column's `<span className="sr-only">Actions</span>`). */
  srOnlyHeader?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** A stable per-row key, mirroring every existing table's `key={row.id}`. */
  rowKey: (row: T) => string | number;
};

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "p-2 font-medium",
                  column.align === "right" && "text-right",
                  column.className,
                )}
              >
                {column.srOnlyHeader ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "p-2",
                    column.align === "right" && "text-right tabular-nums",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
