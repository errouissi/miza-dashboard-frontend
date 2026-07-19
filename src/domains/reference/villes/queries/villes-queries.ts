import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  createVille,
  deleteVille,
  fetchVilleOptions,
  fetchVilles,
  updateVille,
} from "../api/villes-api";
import type { VilleListParams } from "../model/ville";
import { villesKeys } from "./keys";

/**
 * Villes data hooks (FTA §8).
 *
 * STATIC tier: villes are administrative reference data that feed pickers on
 * nearly every form. A rename seen an hour late costs nothing; refetching them
 * on every screen costs a request each time.
 */
export function useVillesQuery(params: VilleListParams) {
  return useQuery({
    queryKey: villesKeys.list(params),
    queryFn: () => fetchVilles(params),
    staleTime: STALE_TIMES.STATIC,
  });
}

/**
 * The ville set for relation pickers, and the ONLY sanctioned way another domain
 * reads villes (FTA §4 — public surface, documented coupling).
 *
 * One parameterless key means one cache entry: a form's select and a table
 * resolving a ville name share the same fetch rather than each keeping their own
 * copy. Consumers derive names from this; nothing caches ville names separately.
 *
 * `enabled` (default `true`) exists for callers that are always mounted
 * regardless of permission — a form drawer's `children` render whether or not
 * the drawer is open (FTA's `FormDrawer` owns only the shell), unlike a filter
 * component that a list page mounts conditionally on `access-dashboard`. Those
 * conditionally-mounted callers (`ManagerVilleFilter`, `CommercialVilleFilter`)
 * need nothing new and keep calling this with no arguments; an always-mounted
 * edit form passes `{ enabled: canReadVilles }` so it never fires the request
 * for an operator who would 403 on it (mirrors ADR-0010's guidance for the B-6
 * catalogue query).
 */
export function useVilleOptionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: villesKeys.options(),
    queryFn: fetchVilleOptions,
    staleTime: STALE_TIMES.STATIC,
    enabled: options?.enabled ?? true,
  });
}

/**
 * All four mutations invalidate the whole villes key space rather than patching
 * the cache. Reference data is small and cached hard; a surgical cache update
 * here would buy nothing and would have to re-derive the server's ordering and
 * pagination to stay honest — which is how a created row appears on the wrong
 * page. Mutations never retry (FTA §11).
 */
function useInvalidateVilles() {
  const queryClient = useQueryClient();
  // `all`, not `lists()`: the picker set (`options()`) is a sibling and holds the
  // same rows. Invalidating only the lists would leave a renamed or deleted ville
  // showing in every relation picker until its staleTime elapsed.
  return () => queryClient.invalidateQueries({ queryKey: villesKeys.all });
}

export function useCreateVilleMutation() {
  const invalidate = useInvalidateVilles();
  return useMutation({
    mutationFn: (nomVille: string) => createVille(nomVille),
    onSuccess: invalidate,
  });
}

export function useUpdateVilleMutation() {
  const invalidate = useInvalidateVilles();
  return useMutation({
    mutationFn: ({ id, nomVille }: { id: number; nomVille: string }) =>
      updateVille(id, nomVille),
    onSuccess: invalidate,
  });
}

export function useDeleteVilleMutation() {
  const invalidate = useInvalidateVilles();
  return useMutation({
    mutationFn: (id: number) => deleteVille(id),
    onSuccess: invalidate,
  });
}
