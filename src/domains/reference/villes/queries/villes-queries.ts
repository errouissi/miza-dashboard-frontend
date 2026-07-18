import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { createVille, deleteVille, fetchVilles, updateVille } from "../api/villes-api";
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
 * All three mutations invalidate the whole villes list space rather than patching
 * the cache. Reference data is small and cached hard; a surgical cache update
 * here would buy nothing and would have to re-derive the server's ordering and
 * pagination to stay honest — which is how a created row appears on the wrong
 * page. Mutations never retry (FTA §11).
 */
function useInvalidateVilles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: villesKeys.lists() });
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
