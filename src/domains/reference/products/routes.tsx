import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ProductsListPage } from "./pages/products-list-page";

/**
 * Products route contributions (FTA §5).
 *
 * The permission is DECLARED here and the guard is generated from it by the route
 * assembler — never hand-wrapped, so a route cannot exist without one.
 *
 * `ACCESS_DASHBOARD` is the honest value: every products action is gated behind
 * that single coarse permission server-side (`ProductController::middleware()`).
 * There is no `view-products` / `create-product` to point at.
 */
export const PRODUCTS_PATH = "/reference/products";

export const productsRoutes: RouteObject[] = [
  {
    path: PRODUCTS_PATH,
    element: <ProductsListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Products",
    },
  },
];
