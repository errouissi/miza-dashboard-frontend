export { PRODUCTS_PATH, productsRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. The app layer
// needs the route contributions and the path (for the nav entry) — nothing else
// (FTA §4). Nothing here is consumed by a sibling domain: Products has no
// relation to resolve, so it neither imports from nor exports to Villes/Secteurs.
