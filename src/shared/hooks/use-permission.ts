import { useMemo } from "react";
import {
  createPermissionResolver,
  type PermissionResolver,
} from "@/infrastructure/permissions";
import { useSession } from "./use-session";

/**
 * Authorization for rendering (FTA §6).
 *
 * Evaluates the permission STRINGS the backend returned at login — never a role
 * (D-5). Roles are a grouping that changes; permission strings are what the server's
 * `permission:*` middleware actually checks, so checking the same string means the
 * UI and the API cannot disagree about what is allowed.
 *
 * This is a UX gate, not a security control. The permission list lives in
 * localStorage and can be edited from a browser console. The backend is the only
 * authority (FTA §17) — a hidden button is not a protected action.
 */
export function usePermission(): PermissionResolver {
  const session = useSession();
  const granted = session?.user.permissions;

  return useMemo(() => createPermissionResolver(granted ?? []), [granted]);
}
