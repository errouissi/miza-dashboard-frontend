/**
 * The permission evaluator (FTA §6).
 *
 * Pure and synchronous: it answers "does this set of granted permissions include
 * X?" and knows nothing about sessions, React, or Miza's domains. That is what
 * makes it trivially testable — and it is also the honest scope of the thing.
 *
 * IMPORTANT, and it must be understood by everyone who touches this file: the
 * result of this evaluator is a UX decision, never a security control. The
 * granted list comes from localStorage and can be edited by anyone with a browser
 * console. The backend is the only authority (FTA §17). A hidden button is not a
 * protected action.
 */

export type PermissionResolver = {
  has(permission: string): boolean;
  hasAny(permissions: readonly string[]): boolean;
  hasAll(permissions: readonly string[]): boolean;
};

export function createPermissionResolver(
  granted: readonly string[] = [],
): PermissionResolver {
  const set = new Set(granted);

  return {
    has: (permission) => set.has(permission),
    hasAny: (permissions) => permissions.some((permission) => set.has(permission)),
    hasAll: (permissions) => permissions.every((permission) => set.has(permission)),
  };
}
