/**
 * The Suppliers query-key factory (FTA §8) — mirrors `companiesKeys` exactly.
 * One parameterless key — the whole point of this endpoint is a single,
 * small, stable picker set. No `list()`/`lists()`: there is no paginated
 * list screen, only the one options query.
 */
export const suppliersKeys = {
  all: ["suppliers"] as const,
  options: () => [...suppliersKeys.all, "options"] as const,
};
