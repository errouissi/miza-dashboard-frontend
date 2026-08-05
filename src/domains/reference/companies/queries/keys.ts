/**
 * The Companies query-key factory (FTA §8).
 *
 * ONE parameterless key — the whole point of this endpoint is a single,
 * small, stable picker set. Mirrors `villesKeys`'/`managersKeys.options()`'s
 * own shape, but this domain has no `list()`/`lists()` at all: there is no
 * paginated list screen, only the one options query.
 */
export const companiesKeys = {
  all: ["companies"] as const,
  options: () => [...companiesKeys.all, "options"] as const,
};
