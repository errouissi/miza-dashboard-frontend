import { httpClient } from "@/infrastructure/http";
import type { Operator, Product, ProductListParams } from "../model/product";

/**
 * The Products endpoints and their mappers (FTA §7, D-6).
 *
 * THE LIST IS AN ARRAY, NOT A PAGE. `ProductController::index` ends in
 * `$query->get()` — no envelope, no `meta`, no pagination. This module returns
 * `Product[]` and does not pretend otherwise: manufacturing a page shape the
 * server never sent would put controls above this layer that the API cannot honour.
 *
 * The write endpoints diverge exactly as Villes' and Secteurs' do:
 *   store    {id, name, operator, value, created_at, updated_at}   <- raw model, 201
 *   update   {status, message, data: {...}}                        <- wrapped
 *   destroy  {message}                                             <- message only
 *
 * `created_at` / `updated_at` arrive on every row and are dropped here. The domain
 * has no use for them, and the mapper is the right place to stop an unused field
 * from spreading into types, components and tests.
 */

type ProductRow = {
  id: number;
  name: string;
  operator: Operator;
  value: number;
  // created_at / updated_at are present on the wire and intentionally unmapped.
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    operator: row.operator,
    // `value` is cast to integer server-side, but a JSON number is a JSON number:
    // normalise so a mapper change upstream cannot leak a float into the domain.
    value: Number(row.value),
  };
}

export async function fetchProducts(params: ProductListParams): Promise<Product[]> {
  const { data } = await httpClient.get<ProductRow[]>("/admin/products", {
    // `operator` is read via `filled()`, so an absent filter must be absent from
    // the query string — not sent empty.
    params: params.operator !== undefined ? { operator: params.operator } : undefined,
  });

  return data.map(toProduct);
}

export type ProductInput = {
  name: string;
  operator: Operator;
  value: number;
};

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await httpClient.post<ProductRow>("/admin/products", {
    name: input.name,
    operator: input.operator,
    value: input.value,
  });
  return toProduct(data);
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  const { data } = await httpClient.put<{ data: ProductRow }>(`/admin/products/${id}`, {
    // All three fields are `required` on update, not just the changed one — the
    // backend re-validates the whole record, so all three are resent.
    name: input.name,
    operator: input.operator,
    value: input.value,
  });
  return toProduct(data.data);
}

export async function deleteProduct(id: number): Promise<void> {
  await httpClient.delete(`/admin/products/${id}`);
}
