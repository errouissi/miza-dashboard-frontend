import { httpClient } from "@/infrastructure/http";
import type { Admin, AssignablePermission } from "../model/admin";

/**
 * The Admins endpoints and their mappers (FTA §7, D-6).
 *
 * A FOURTH DISTINCT ENVELOPE SET. Nothing above this layer knows it:
 *   index    [ {...}, ... ]                       raw array, no envelope
 *   store    { message, admin: {...} }   201
 *   update   { message, admin: {...} }   201      <- 201 on an UPDATE, not 200
 *   destroy  { status, message }         200
 *   status   { message, is_active }      200      <- the flipped value, not the record
 *
 * The `update` 201 is the backend's actual behaviour (`AdminController::update`
 * passes 201 explicitly). Harmless to a client that reads the body rather than the
 * status, which is why nothing here branches on it — but it is recorded so the next
 * reader does not assume it is a typo in this file.
 *
 * `roles` and `created_at` arrive on every row and are dropped — see the model
 * for why each is deliberately unmodelled. `permissions` IS mapped: B-6 gave it a
 * consumer (the edit form seeds from it), so it is modelled now and was not before.
 */

type AdminRow = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  /** Eager-loaded as `permissions:name`, so each entry carries a name only. */
  permissions?: { name: string }[];
  // created_at and roles[] are present on the wire and intentionally unmapped.
};

function toAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    // The backend casts is_active to boolean, but a JSON 0/1 would be truthy-wrong,
    // so the domain boundary normalises rather than trusting the shape.
    isActive: Boolean(row.is_active),
    permissions: (row.permissions ?? []).map((permission) => permission.name),
  };
}

/** The catalogue's envelope: `{ data: [...] }`, no links/meta — it is not paginated. */
type PermissionRow = {
  name: string;
  label: string;
  group: string;
};

/**
 * The assignable-permission catalogue (backend B-6) — the ONLY source of truth
 * for what may be granted. It is not derived from any user's own grants: the
 * backend's own note records that deriving it from the super-admin was both an
 * implementation detail and lossy, since `create-grattage-sale` is seeded after
 * the super-admin sync and so never appeared.
 *
 * Gated on `create-admin|update-admin`, NOT on `access-dashboard` — a read-only
 * operator who can see the Admins list gets a 403 here. Callers must only fetch
 * it where the form is actually reachable.
 *
 * Returned in `name ASC`; blank-named rows and the non-assignable deny-list are
 * excluded server-side, so no client-side filtering is required or performed.
 */
export async function fetchAssignablePermissions(): Promise<AssignablePermission[]> {
  const { data } = await httpClient.get<{ data: PermissionRow[] }>("/admin/permissions");
  return data.data.map((row) => ({
    name: row.name,
    label: row.label,
    group: row.group,
  }));
}

export async function fetchAdmins(): Promise<Admin[]> {
  // No query parameters: the endpoint accepts none.
  const { data } = await httpClient.get<AdminRow[]>("/admin/admins");
  return data.map(toAdmin);
}

export type CreateAdminInput = {
  name: string;
  email: string;
  password: string;
  /** Permission NAMES, exactly as the catalogue supplies them. */
  permissions: string[];
};

export async function createAdmin(input: CreateAdminInput): Promise<Admin> {
  const { data } = await httpClient.post<{ admin: AdminRow }>("/admin/admins", {
    name: input.name,
    email: input.email,
    password: input.password,
    permissions: input.permissions,
  });
  return toAdmin(data.admin);
}

export type UpdateAdminInput = {
  name: string;
  email: string;
  /**
   * OMITTED when the operator did not touch the permission selection.
   *
   * This is load-bearing, not an optimisation. `AdminController::update` calls
   * `syncPermissions` whenever the key is PRESENT, and sync REPLACES the whole
   * set. Sending the key on every save would mean a rename could silently strip
   * a grant the selector could not represent — the catalogue is deliberately
   * narrower than the validator (it excludes the commercial-only grattage
   * permissions), so "everything the picker shows" is not provably "everything
   * the admin holds".
   *
   * Omitting the key leaves the backend's permission state untouched. It is sent
   * only when the operator deliberately changed the selection, which is the one
   * case where replacing the set is what they asked for.
   */
  permissions?: string[];
};

export async function updateAdmin(id: number, input: UpdateAdminInput): Promise<Admin> {
  // No password: `AdminController::update` does not accept one.
  const { data } = await httpClient.put<{ admin: AdminRow }>(`/admin/admins/${id}`, {
    name: input.name,
    email: input.email,
    ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
  });
  return toAdmin(data.admin);
}

/**
 * Flips `is_active`. The endpoint takes no body — the backend reads the current
 * value and inverts it — and returns the resulting state rather than the record.
 */
export async function toggleAdminStatus(id: number): Promise<boolean> {
  const { data } = await httpClient.patch<{ is_active: boolean }>(`/admin/admins/${id}`);
  return Boolean(data.is_active);
}

export async function deleteAdmin(id: number): Promise<void> {
  await httpClient.delete(`/admin/admins/${id}`);
}
