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
 * ENTRIES ARE ADDED PER RESOURCE (resource recipe, step 1) — never ahead of the
 * domain that uses them, which would be guessing at a backend contract.
 */
export const PERMISSIONS = Object.freeze({
  /**
   * The only permission guarding reference data. Villes, Secteurs and Products
   * are ALL gated behind this single coarse string server-side
   * (`routes/api.php:160-165`, `VilleController::middleware()`) — there is no
   * `view-villes` / `create-ville` / `update-ville` / `delete-ville`.
   *
   * So every ville action resolves to the same check, including the ones the UI
   * renders separately (create, edit, delete). That is not a modelling shortcut
   * here; it mirrors what the server actually enforces, which is the whole point
   * of this registry. Granular ville permissions are an open backend question —
   * when they land, the entries split here and the call sites follow.
   */
  ACCESS_DASHBOARD: "access-dashboard",

  /**
   * Admin management — the FIRST genuinely granular permission set in the product.
   *
   * Unlike the reference resources, these are four distinct server-side checks
   * (`routes/api.php`: create-admin, update-admin, block-admin, delete-admin),
   * each guarding one route. So the UI gates each action independently rather than
   * collapsing them into one "can manage" flag — which is what D-5 was designed
   * for and what reference data could not exercise.
   */
  CREATE_ADMIN: "create-admin",
  UPDATE_ADMIN: "update-admin",
  BLOCK_ADMIN: "block-admin",
  DELETE_ADMIN: "delete-admin",

  /**
   * Agent management — managers and commercials share one permission set, because
   * the backend gives them one controller and one set of routes
   * (`routes/api.php:193-232`).
   *
   * `VIEW_AGENTS` is the first LIST permission in the product that is not
   * `access-dashboard`: reference data and Admins are both behind that coarse
   * string, agents are not. It gates the managers list, the commercials list and
   * the single-agent read.
   *
   * BLOCK and ACTIVATE are SEPARATE server-side checks on separate routes, so they
   * are separate entries here. An operator can hold one and not the other, and
   * collapsing them into one "can change status" flag would show a control the API
   * would refuse.
   *
   * DELIBERATELY ABSENT until they have a caller (this file's own rule — entries
   * are added per resource, never ahead of the domain that uses them):
   *   `create-agent`         — agent onboarding is the M3.6 wizard, not M3.2.
   *   `manage-agent-status`  — guards `toggle-status`, which this domain does not
   *                            use: it flips active↔blocked only and so cannot
   *                            express the third status. Block and activate are
   *                            precise; the toggle is not.
   *   `delete-agent`         — guards `destroy`, which sets `status = 'blocked'`
   *                            and is therefore the same outcome as `block`
   *                            (BC-R). Registering it would imply the UI offers a
   *                            deletion it cannot honestly perform.
   */
  VIEW_AGENTS: "view-agents",
  UPDATE_AGENT: "update-agent",
  BLOCK_AGENT: "block-agent",
  ACTIVATE_AGENT: "activate-agent",
} as const satisfies Record<string, string>);

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Roles are NOT an authorization primitive here (FTA D-5). They exist on the
 * session because the backend sends them; nothing may branch on them. Kept as a
 * named constant so a reviewer grepping for role checks finds this note first.
 */
export const ROLES_ARE_NOT_AUTHORIZATION = true as const;
