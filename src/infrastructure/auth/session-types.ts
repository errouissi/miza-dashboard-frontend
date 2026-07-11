/**
 * The session, mirroring the backend's real login payload:
 *
 *   { success: true, token, user: { id, name, email, roles, permissions } }
 *
 * `permissions` is the authorization primitive (FTA D-5). `roles` is carried
 * because the backend sends it, but MUST NOT be used to authorize anything —
 * no code in this application branches on a role.
 */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

export type Session = {
  token: string;
  user: SessionUser;
};
