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
  /**
   * The assignable-permission catalogue. A sibling of the admin list rather than
   * a child: it is a separate endpoint with its own permission gate and its own
   * lifetime, and mutating an admin does not change what MAY be assigned. Keeping
   * it outside `lists()` is what stops admin mutations from needlessly
   * invalidating it.
   */
  assignablePermissions: () => [...adminsKeys.all, "assignable-permissions"] as const,
};
