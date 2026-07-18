import { httpClient } from "@/infrastructure/http";
import type { Admin } from "../model/admin";

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
 * `roles`, `permissions` and `created_at` arrive on every row and are dropped —
 * see the model for why each one is deliberately unmodelled.
 */

type AdminRow = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  // created_at, roles[], permissions[] are present on the wire and intentionally unmapped.
};

function toAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    // The backend casts is_active to boolean, but a JSON 0/1 would be truthy-wrong,
    // so the domain boundary normalises rather than trusting the shape.
    isActive: Boolean(row.is_active),
  };
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
};

export async function createAdmin(input: CreateAdminInput): Promise<Admin> {
  // `permissions` is deliberately NOT sent. The backend accepts the key, but no
  // endpoint publishes the assignable catalogue (BC-M), so there is nothing
  // legitimate to put in it. Omitting it leaves the new admin with the `admin`
  // role's defaults, which is the backend's own behaviour when the key is absent.
  const { data } = await httpClient.post<{ admin: AdminRow }>("/admin/admins", {
    name: input.name,
    email: input.email,
    password: input.password,
  });
  return toAdmin(data.admin);
}

export type UpdateAdminInput = {
  name: string;
  email: string;
};

export async function updateAdmin(id: number, input: UpdateAdminInput): Promise<Admin> {
  // No password: `AdminController::update` does not accept one. No permissions:
  // see BC-M above. Sending `permissions` here would be worse than omitting it —
  // the backend syncs whenever the key is PRESENT, so an empty array would strip
  // every permission the admin holds.
  const { data } = await httpClient.put<{ admin: AdminRow }>(`/admin/admins/${id}`, {
    name: input.name,
    email: input.email,
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
