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
 *
 * `enabled` (default `true`) mirrors `useVilleOptionsQuery`'s own parameter —
 * added for the M3.6 onboarding wizard's Sector field (a second, city-scoped
 * caller), so it can gate the request both on `access-dashboard` and on a
 * city actually being selected, rather than firing an unfiltered fetch (or
 * one this session cannot read) while there is nothing to scope it to. The
 * original caller (`SecteursListPage`) is unaffected — it never passes the
 * option and keeps the default.
 */
export function useSecteursQuery(
  params: SecteurListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: secteursKeys.list(params),
    queryFn: () => fetchSecteurs(params),
    staleTime: STALE_TIMES.STATIC,
    enabled: options?.enabled ?? true,
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
