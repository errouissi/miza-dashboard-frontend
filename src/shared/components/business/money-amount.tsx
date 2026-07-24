import { cn } from "@/shared/lib/utils";
import { formatMoney } from "@/shared/formatters";

/**
 * Renders a money value through the one shared formatter (Design System §5)
 * — tabular numerals so a column of amounts aligns, and the danger text
 * colour on a negative value, which `formatMoney` itself does not apply (it
 * returns a string, not styled output).
 *
 * TAKES A NUMBER, NOT A STRING. This is the one real constraint on where
 * this component fits: Managers'/Commercials' `avanceTotal` (a `bcadd`
 * accessor string) and Clients' `solde` (a `decimal:2`-cast string) are
 * BOTH deliberately carried and rendered verbatim, never parsed back to a
 * number — parsing a backend-computed decimal string would put it through
 * binary floating point, which is the one thing money must not do (see
 * `model/manager.ts`'s and `model/client.ts`'s own docblocks). `MoneyAmount`
 * is for genuinely numeric `decimal`-cast values with no such computation
 * behind them — Products' `value` today; Money's Cheque/Deposit/Debt
 * Payment `amount` fields once that domain is built. Do not reach for this
 * component to render `avanceTotal` or `solde` — that would be exactly the
 * "convenience over correctness" defect `formatMoney`'s own docblock warns
 * against, just moved one layer up.
 *
 * TEXT ALIGNMENT IS NOT THIS COMPONENT'S JOB. "Right-aligned in tables"
 * (Design System §5) is a property of the table cell, not of the value —
 * a stat tile or a confirmation dialog renders the same amount without a
 * table around it. The caller's container owns alignment; this component
 * owns only what is true of the value itself everywhere it appears.
 */
export type MoneyAmountProps = {
  value: number | null | undefined;
  className?: string;
};

export function MoneyAmount({ value, className }: MoneyAmountProps) {
  const isNegative = typeof value === "number" && value < 0;

  return (
    <span className={cn("tabular-nums", isNegative && "text-destructive", className)}>
      {formatMoney(value)}
    </span>
  );
}
