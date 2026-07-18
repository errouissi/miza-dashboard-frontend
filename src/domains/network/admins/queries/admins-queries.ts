import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  createAdmin,
  deleteAdmin,
  fetchAdmins,
  fetchAssignablePermissions,
  toggleAdminStatus,
  updateAdmin,
  type CreateAdminInput,
  type UpdateAdminInput,
} from "../api/admins-api";
import { adminsKeys } from "./keys";

/**
 * Admins data hooks (FTA §8).
 *
 * SLOW tier, not STATIC. Admins are network identity, not reference data: an
 * account blocked on one screen while another operator still sees it as active is
 * an access-control question, and five minutes is the documented tolerance for
 * identity data. Villes/Secteurs/Products use STATIC because a stale city name
 * costs nothing; a stale account status is not the same class of fact.
 */
export function useAdminsQuery() {
  return useQuery({
    queryKey: adminsKeys.list(),
    queryFn: fetchAdmins,
    staleTime: STALE_TIMES.SLOW,
  });
}

/**
 * The assignable-permission catalogue (backend B-6).
 *
 * STATIC tier: this is the authorization VOCABULARY, not identity data. It
 * changes only when a phase ships a new permission — a deployment event, not a
 * working-day one. Contrast the admin list itself, which is SLOW because it
 * carries account status.
 *
 * `enabled` is the caller's, and it matters: the endpoint is gated on
 * `create-admin|update-admin` while the Admins LIST is gated on
 * `access-dashboard`. A read-only operator can open the page but would get a 403
 * here, so the query must not fire until the form that needs it is actually open.
 */
export function useAssignablePermissionsQuery({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: adminsKeys.assignablePermissions(),
    queryFn: fetchAssignablePermissions,
    staleTime: STALE_TIMES.STATIC,
    enabled,
  });
}

/**
 * Every mutation reshapes the single list, so all of them invalidate the LIST
 * space — deliberately `lists()` and not `all`.
 *
 * `all` would also drop the assignable-permission catalogue, which no admin
 * mutation can change: creating or blocking an admin does not alter what MAY be
 * assigned. Invalidating it would re-fetch 66 rows on every save for nothing.
 */
function useInvalidateAdmins() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminsKeys.lists() });
}

export function useCreateAdminMutation() {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: (input: CreateAdminInput) => createAdmin(input),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminMutation() {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAdminInput & { id: number }) =>
      updateAdmin(id, input),
    onSuccess: invalidate,
  });
}

export function useToggleAdminStatusMutation() {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: (id: number) => toggleAdminStatus(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminMutation() {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: (id: number) => deleteAdmin(id),
    onSuccess: invalidate,
  });
}
