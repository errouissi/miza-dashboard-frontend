/**
 * A product — a recharge/grattage card, belonging to one telecom operator.
 *
 * `value` is the card's FACE VALUE IN DIRHAMS: `products.value` is an integer,
 * and the factory seeds the standard Moroccan denominations (5, 10, 20, 50, 100).
 * It is product metadata, not a transactional price — grattage sales carry their
 * own `unit_price`, and nothing in the backend's services reads this column.
 *
 * `created_at` / `updated_at` EXIST on the wire — `products` has timestamps and
 * the model sets no `$hidden`, unlike villes and secteurs. They are deliberately
 * NOT mapped: no screen sorts or displays them, and modelling a field with no
 * caller is exactly the speculation FTA D-11 forbids.
 */
export type Product = {
  id: number;
  name: string;
  operator: Operator;
  /** Face value in dirhams. Integer — the backend rejects decimals. */
  value: number;
};

/**
 * The operators, mirroring the backend's `in:IAM,INWI,ORANGE` rule and the DB-level
 * `enum('IAM','INWI','ORANGE')`.
 *
 * Kept INSIDE this domain. It is product-specific backend knowledge, and `shared/`
 * may hold no domain knowledge (FTA §4) — a constant that knows what a telecom
 * operator is belongs with the resource that has one.
 */
export const OPERATORS = ["IAM", "INWI", "ORANGE"] as const;
export type Operator = (typeof OPERATORS)[number];

export function isOperator(value: string | null): value is Operator {
  return value !== null && OPERATORS.includes(value as Operator);
}

/**
 * The ONE deterministic name-generation rule (Manager Demo Readiness, Item
 * 1 — and its own manual-QA correction): `"{OPERATOR} {VALUE}DH"`, e.g.
 * `generateProductName("IAM", 10) === "IAM 10DH"`. Name is NOT independent
 * business data — it is always fully determined by (operator, value) — so
 * this is the single function BOTH `ProductFormSheet`'s create and edit
 * paths call, never two copies of the same template string. `DH` is a
 * literal uppercase suffix, never derived from user input, so it can never
 * drift to the lowercase `"...dh"` a legacy pre-this-feature row might
 * carry (see the form's own docblock for why a legacy name is left alone
 * until that product is next edited — no bulk migration here).
 */
export function generateProductName(operator: Operator, value: number): string {
  return `${operator} ${value}DH`;
}

/**
 * The list query surface — one optional filter, which is the whole of what
 * `ProductController::index` accepts (`$request->filled('operator')`).
 *
 * No `page`, `perPage`, `search`, `sort` or `direction`: the endpoint ends in
 * `$query->get()`. Modelling parameters the API ignores invites a UI that appears
 * to filter and does not.
 */
export type ProductListParams = {
  operator?: Operator;
};

/** `value` is `integer|min:0` server-side — zero is permitted, decimals are not. */
export const MIN_VALUE = 0;

/**
 * A product, reduced to what a line-item picker needs (roadmap M5, Phase
 * 1) — the first cross-domain caller of Products' own public surface.
 * Sliced from the same unfiltered `fetchProducts()` read every reference
 * screen already uses; no new endpoint. Every `product_id` FormRequest rule
 * across all four Stock movement types (`exists:products,id`, verified
 * fresh from source) accepts any product regardless of `operator` — so this
 * picker deliberately does not filter by operator either, mirroring the
 * backend's own unrestricted `exists` rule rather than inventing a
 * narrower picker the validator does not ask for.
 */
export type ProductOption = {
  id: number;
  name: string;
};
