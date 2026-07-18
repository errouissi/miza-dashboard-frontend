import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  createAdmin,
  deleteAdmin,
  fetchAdmins,
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

/** Every mutation reshapes the single list, so all of them invalidate its whole space. */
function useInvalidateAdmins() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminsKeys.all });
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
