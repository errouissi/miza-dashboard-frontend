/**
 * The permission registry (FTA §6).
 *
 * The ONLY place a permission string literal appears in this codebase. A string
 * typed inline in a component cannot be renamed, found, or audited — which is how
 * the sidebar and the route guards drifted apart in the legacy build.
 *
 * Names MUST mirror the backend's App\Authorization\*Permissions classes exactly.
 * They are what Spatie's `permission:*` middleware actually checks; checking the
 * same string the server checks is what makes it impossible for the UI and the API
 * to disagree about what is allowed.
 *
 * ENTRIES ARE ADDED PER RESOURCE (resource recipe, step 1). Empty in PR-1 is
 * correct: no resource exists yet, and inventing permission names ahead of the
 * domains that use them would be guessing at a backend contract.
 */
export const PERMISSIONS: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Roles are NOT an authorization primitive here (FTA D-5). They exist on the
 * session because the backend sends them; nothing may branch on them. Kept as a
 * named constant so a reviewer grepping for role checks finds this note first.
 */
export const ROLES_ARE_NOT_AUTHORIZATION = true as const;
