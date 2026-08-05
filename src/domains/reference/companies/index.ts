/**
 * The company set, for the Allocation create form's picker and its list
 * filter (roadmap M5, Phase 4) — the ONLY consumer today. No `*_PATH`, no
 * routes: unlike Villes/Secteurs/Products, Companies is NOT a
 * dashboard-managed screen (no create/edit/delete HTTP surface exists at
 * all — see `model/company.ts`'s own docblock), so there is nothing for the
 * app router to assemble here.
 */
export { useCompanyOptionsQuery } from "./queries/companies-queries";
export type { Company } from "./model/company";

// api/, queries/keys.ts stay internal.
