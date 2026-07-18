import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
  type ProductInput,
} from "../api/products-api";
import type { ProductListParams } from "../model/product";
import { productsKeys } from "./keys";

/**
 * Products data hooks (FTA §8).
 *
 * STATIC tier, same reasoning as Villes and Secteurs: administrative reference
 * data whose staleness costs nothing, read on many screens.
 */
export function useProductsQuery(params: ProductListParams) {
  return useQuery({
    queryKey: productsKeys.list(params),
    queryFn: () => fetchProducts(params),
    staleTime: STALE_TIMES.STATIC,
  });
}

/**
 * Invalidates every products list. Broad on purpose: a product can CHANGE OPERATOR
 * on edit, so the row leaves one filtered list and joins another — patching a
 * single cache entry would leave it visible under its old operator.
 */
function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: productsKeys.all });
}

export function useCreateProductMutation() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProductMutation() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, ...input }: ProductInput & { id: number }) =>
      updateProduct(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProductMutation() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: invalidate,
  });
}
