import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type { Operator } from "@/domains/reference/products";
import type {
  StockMovement,
  StockMovementHolder,
  StockMovementListParams,
  StockMovementReference,
} from "../model/stock-movement";

type StockMovementHolderRow = {
  type: string;
  id: number;
  label: string | null;
};

type StockMovementReferenceRow = {
  type: string;
  id: number;
};

type StockMovementRow = {
  id: number;
  created_at: string | null;
  movement_type: string;
  movement_type_label: string;
  status: string;
  quantity: number;
  product: { id: number; name: string; operator: Operator; value: number } | null;
  source: StockMovementHolderRow | null;
  destination: StockMovementHolderRow | null;
  actor: null;
  reference: StockMovementReferenceRow | null;
};

/**
 * `GET /admin/stock/movements` — verified fresh from source
 * (`StockController::movements()` → `StockService::paginateMovements()`).
 *
 * THIS IS LARAVEL'S RAW, UN-WRAPPED `LengthAwarePaginator::toArray()`
 * SHAPE — `paginateMovements()` returns the paginator directly
 * (`response()->json($stock->paginateMovements($filters, $perPage))`), NOT
 * wrapped in a `JsonResource` collection. That makes it structurally FLAT
 * (`current_page`/`per_page`/`total`/`last_page` all top-level), NOT this
 * project's usual `{data, meta: {current_page, ...}}` envelope —
 * `fromLaravelPage()` does not apply here and must not be used. Confirmed
 * directly from this session's own backend test assertions
 * (`assertJsonPath('total', ...)`/`'per_page'`/`'last_page'`, all
 * top-level, no `meta` key). Only the five fields this app actually
 * consumes are declared; the paginator's other fields
 * (`first_page_url`/`from`/`last_page_url`/`links`/`next_page_url`/`path`/
 * `prev_page_url`/`to`) are simply absent from this type.
 */
type StockMovementsFlatPaginator = {
  current_page: number;
  data: StockMovementRow[];
  per_page: number;
  total: number;
  last_page: number;
};

function toHolder(row: StockMovementHolderRow | null): StockMovementHolder | null {
  return row ? { type: row.type, id: row.id, label: row.label } : null;
}

function toReference(
  row: StockMovementReferenceRow | null,
): StockMovementReference | null {
  return row ? { type: row.type, id: row.id } : null;
}

function toStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    createdAt: row.created_at,
    movementType: row.movement_type,
    movementTypeLabel: row.movement_type_label,
    status: row.status,
    quantity: row.quantity,
    product: row.product
      ? {
          id: row.product.id,
          name: row.product.name,
          operator: row.product.operator,
          value: row.product.value,
        }
      : null,
    source: toHolder(row.source),
    destination: toHolder(row.destination),
    reference: toReference(row.reference),
  };
}

/**
 * Domain-local flat-paginator normalizer — the sibling `fromLaravelPage()`
 * (`infrastructure/http/paginated.ts`) intentionally does NOT apply (see
 * the module docblock above). Kept local to this resource, not promoted to
 * shared/infrastructure on a single occurrence (Rule-of-Three) — if a
 * second endpoint is ever found to share this exact flat shape, that is
 * the evidence to revisit this decision, not before.
 */
function fromFlatPaginator(
  envelope: StockMovementsFlatPaginator,
): Paginated<StockMovement> {
  return {
    items: envelope.data.map(toStockMovement),
    page: envelope.current_page,
    perPage: envelope.per_page,
    total: envelope.total,
    lastPage: envelope.last_page,
  };
}

export async function fetchStockMovements(
  params: StockMovementListParams,
): Promise<Paginated<StockMovement>> {
  const { data } = await httpClient.get<StockMovementsFlatPaginator>(
    "/admin/stock/movements",
    {
      params: {
        page: params.page,
        // Every optional filter is OMITTED rather than sent empty —
        // mirrors every other Stock/Grattage list's own convention
        // (`IndexBonRequest`'s rules are all `sometimes`; this endpoint's
        // own validator rules are all `nullable`). No `per_page` — Phase 2
        // uses the backend default (15) by decision.
        ...(params.type ? { type: params.type } : {}),
        ...(params.operator ? { operator: params.operator } : {}),
        ...(params.productId ? { product_id: params.productId } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      },
    },
  );

  return fromFlatPaginator(data);
}
