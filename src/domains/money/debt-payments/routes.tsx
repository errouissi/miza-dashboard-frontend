import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DebtPaymentsListPage } from "./pages/debt-payments-list-page";
import { CreateDebtPaymentPage } from "./pages/create-debt-payment-page";

/**
 * Debt Payments route contributions (FTA §5) — the third and final Money
 * resource (roadmap M4).
 *
 * BOTH ROUTES ARE GATED ON THE SAME `debt_cash` PERMISSION — verified fresh
 * from source (`routes/api.php:167-170`): `GET /admin/debt-payments` AND
 * `POST /admin/debt-payments` carry the identical `permission:debt_cash`
 * check, unlike Cheques/Deposits' own split view/create vocabularies. This
 * mirrors the backend exactly rather than inventing a split permission this
 * resource does not have.
 *
 * TWO FLAT SIBLING ROUTES, not nested `children` — same ADR-0014/FE-2
 * reasoning every other Money `*_NEW_PATH` already established.
 *
 * NO DETAIL ROUTE — `GET /admin/debt-payments/{id}` is commented out in
 * `routes/api.php` (dead code, confirmed from source); there is nothing to
 * route a detail page to.
 */
export const DEBT_PAYMENTS_PATH = "/money/debt-payments";
export const DEBT_PAYMENTS_NEW_PATH = "/money/debt-payments/new";

export const debtPaymentsRoutes: RouteObject[] = [
  {
    path: DEBT_PAYMENTS_PATH,
    element: <DebtPaymentsListPage />,
    handle: {
      permission: PERMISSIONS.DEBT_PAYMENTS,
      breadcrumb: "Debt Payments",
    },
  },
  {
    path: DEBT_PAYMENTS_NEW_PATH,
    element: <CreateDebtPaymentPage />,
    handle: {
      permission: PERMISSIONS.DEBT_PAYMENTS,
      breadcrumb: "Record debt payment",
    },
  },
];
