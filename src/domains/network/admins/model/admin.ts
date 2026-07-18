/**
 * An admin — a dashboard staff account.
 *
 * The backend list selects `id, name, email, is_active, created_at` and eager-loads
 * `roles:name` and `permissions:name`. Three of those are deliberately NOT modelled:
 *
 *   `roles`       — the application authorizes on PERMISSION STRINGS, never roles
 *                   (FTA D-5). Mapping roles into the domain would put the tempting
 *                   thing one property access away; leaving them out keeps the rule
 *                   structural rather than aspirational.
 *
 *   `created_at`  — on the wire, but no screen sorts or shows it. Modelling a field
 *                   with no caller is speculation (FTA D-11), as with Products.
 *
 * `permissions` IS now modelled. It was omitted in M3.1 because nothing consumed
 * it; B-6 gave it a consumer — the edit form must seed from an admin's current
 * grants, since the backend's update applies SYNC semantics. This is the
 * map-only-consumed-fields judgment working as intended: a field is modelled when
 * a screen reads it, not before.
 *
 * `isActive` is a BOOLEAN, not the agents' three-value status enum. It is rendered
 * with a domain-owned label; Admins is deliberately NOT evidence for a future
 * enum-based StatusBadge.
 */
export type Admin = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  /** Permission NAMES currently granted. Names are the backend's contract. */
  permissions: string[];
};

/**
 * One entry from the assignable-permission catalogue (`GET /admin/permissions`,
 * backend B-6). All three fields are always present: the backend falls back to a
 * de-kebabbed label and a default group when no curated value exists, so neither
 * is optional and neither needs a client-side fallback.
 *
 * `name` is the only identifier — the catalogue deliberately exposes no `id`,
 * because `name` is what Create/Update Admin accept and an id would break on a
 * reseed. `label` and `group` are presentation only and must never be sent back.
 */
export type AssignablePermission = {
  name: string;
  label: string;
  group: string;
};

/**
 * The list takes no parameters. `AdminController::index()` accepts none — no
 * pagination, no search, no filter, no sort — so there is nothing to model.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 8;
