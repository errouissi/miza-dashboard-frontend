import type { ReactNode } from "react";

/**
 * The list-page filter row shell (Architecture §7), extracted at M4.2 from
 * FOUR working screens — Villes, Managers, Commercials, Clients — whose
 * filter row was the identical `flex flex-wrap items-end gap-3` wrapper
 * around one-or-more `flex flex-col gap-1.5` label+control blocks.
 *
 * NOT the fully declarative, config-driven filter system Architecture §7's
 * own description gestures at ("typed filter chips... declared per
 * resource"). Building THAT — a generic field-type registry covering text/
 * select/date-range/async-picker from a config object — has no second
 * shape to validate it against yet: every existing filter is a bespoke
 * control (a plain `<select>`, a `<Input type="date">`, a domain-specific
 * async picker like `ManagerVilleFilter`) composed as `ListPage`'s
 * `filters` children, never generated from a shared config. `FilterBar`
 * extracts exactly the PROVEN, IDENTICAL wrapper shape — nothing about
 * field types — and stays a slot, the same way `ListPage.filters` already
 * is: the caller composes whatever controls the resource actually needs
 * (generic `FilterField`s, or a bespoke domain component alongside them,
 * exactly as `ManagerVilleFilter` already sits next to generic fields in
 * Managers' own filter row) — `FilterBar` never looks inside its children.
 */
export type FilterBarProps = {
  children: ReactNode;
};

export function FilterBar({ children }: FilterBarProps) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

/**
 * One label+control block — the `flex flex-col gap-1.5` + `<label>` pairing
 * every existing filter (and every existing edit-form field, though this
 * extraction is scoped to filters only) repeats verbatim. `htmlFor` is
 * required, not inferred, because the control is an opaque `children` node
 * — `FilterField` has no way to generate or read the id itself.
 */
export type FilterFieldProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
};

export function FilterField({ label, htmlFor, children }: FilterFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
