/**
 * The supplier set, for the Bon create form's picker (roadmap M5, Phase 5)
 * — the ONLY consumer today. No `*_PATH`, no routes: Suppliers is NOT a
 * dashboard-managed screen, the identical restraint `domains/reference/
 * companies/` already applies.
 */
export { useSupplierOptionsQuery } from "./queries/suppliers-queries";
export type { Supplier } from "./model/supplier";

// api/, queries/keys.ts stay internal.
