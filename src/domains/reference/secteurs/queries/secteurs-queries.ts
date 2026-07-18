import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  createSecteur,
  deleteSecteur,
  fetchSecteurs,
  updateSecteur,
  type SecteurInput,
} from "../api/secteurs-api";
import type { SecteurListParams } from "../model/secteur";
import { secteursKeys } from "./keys";

/**
 * Secteurs data hooks (FTA §8).
 *
 * STATIC tier, same reasoning as Villes: administrative reference data that feeds
 * pickers elsewhere, where an hour-stale name costs nothing.
 */
export function useSecteursQuery(params: SecteurListParams) {
  return useQuery({
    queryKey: secteursKeys.list(params),
    queryFn: () => fetchSecteurs(params),
    staleTime: STALE_TIMES.STATIC,
  });
}

/**
 * Invalidates every secteurs list. Broad on purpose: a secteur can MOVE between
 * villes on edit, so the row leaves one filtered list and joins another — patching
 * a single cache entry would leave it visible under its old ville.
 */
function useInvalidateSecteurs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: secteursKeys.all });
}

export function useCreateSecteurMutation() {
  const invalidate = useInvalidateSecteurs();
  return useMutation({
    mutationFn: (input: SecteurInput) => createSecteur(input),
    onSuccess: invalidate,
  });
}

export function useUpdateSecteurMutation() {
  const invalidate = useInvalidateSecteurs();
  return useMutation({
    mutationFn: ({ id, ...input }: SecteurInput & { id: number }) =>
      updateSecteur(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSecteurMutation() {
  const invalidate = useInvalidateSecteurs();
  return useMutation({
    mutationFn: (id: number) => deleteSecteur(id),
    onSuccess: invalidate,
  });
}
