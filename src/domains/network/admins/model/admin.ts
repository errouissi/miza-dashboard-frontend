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
 *   `permissions` — permission management is out of scope for M3.1: the backend
 *                   publishes no catalogue of assignable permissions (BC-M), and an
 *                   empty-named permission currently exists in the table (BC-D).
 *                   Not modelling them means this domain neither displays nor
 *                   silently filters that defect — it simply does not touch it.
 *
 *   `created_at`  — on the wire, but no screen sorts or shows it. Modelling a field
 *                   with no caller is speculation (FTA D-11), as with Products.
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
};

/**
 * The list takes no parameters. `AdminController::index()` accepts none — no
 * pagination, no search, no filter, no sort — so there is nothing to model.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 8;
