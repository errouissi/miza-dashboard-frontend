/**
 * The Admins query-key factory (FTA §8).
 *
 * MUST be the only source of an admins key. `list()` takes no parameters because
 * the endpoint accepts none — there is no filter, page or sort to key on.
 */
export const adminsKeys = {
  all: ["admins"] as const,
  lists: () => [...adminsKeys.all, "list"] as const,
  list: () => [...adminsKeys.lists()] as const,
};
