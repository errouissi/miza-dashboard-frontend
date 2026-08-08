import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type {
  GrattageInvoice,
  GrattageInvoiceListParams,
  GrattageInvoiceSaleLine,
  GrattageInvoiceStatus,
} from "../model/grattage-invoice";

/**
 * The Grattage Invoices endpoints and their mapper (FTA §7, D-6).
 *
 * `index()`/`show()` BOTH USE THE SAME FLAT-PAGINATOR-STYLE ENVELOPE AS
 * CLIENTS — verified fresh from source this phase
 * (`GrattageInvoiceController::index`/`show`, `routes/api.php:378-400`):
 * `index()` is `{success, data: <raw Laravel paginator>}` (no Resource
 * class at all, `$query->paginate(...)` returned directly), and `show()`
 * is `{success, data: <raw model>}`. `fromLaravelPage` is NOT reused here
 * for the same reason `clients-api.ts` already documents: it expects
 * `envelope.meta`, which this shape does not have — mirror Clients' own
 * mapper, not Bons'/Villes'.
 *
 * NO `transform()` ANYWHERE — every row is the raw Eloquent serialization
 * of `GrattageInvoice`, with `agent`/`client` as FULL, UNRESTRICTED nested
 * models (no `->with(['agent:id,...'])` column list). `GrattageInvoiceRow`
 * therefore models only the wire keys this screen actually reads
 * (ADR-0008) — everything else riding along (`agent.photo_path`,
 * `agent.salaire`, `client.latitude`, `client.otp_verified_at`, etc.) is
 * deliberately absent from this type.
 */

type GrattageInvoiceAgentRow = {
  id: number;
  nom: string;
  prenom: string;
  /** The RAW column (verified from `Agent::$fillable`) — `num_de_compte` is only an accessor alias, not what a non-Resource raw serialization emits. */
  num_compte: string;
};

/** `Client` has no name field at all (verified from `Client::$fillable`, backend) — `phone` is its only identifier. */
type GrattageInvoiceClientRow = {
  id: number;
  phone: string;
};

type GrattageInvoiceSaleRow = {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
  total: string;
};

type GrattageInvoiceRow = {
  id: number;
  status: GrattageInvoiceStatus;
  total_amount: string;
  sold_at: string;
  due_at: string;
  declared_at: string | null;
  /** Raw column, present even though it is not in `$fillable` — mass-assignment restriction does not affect serialization. `null` until a reconciliation deposit links this invoice. */
  deposit_id: number | null;
  agent: GrattageInvoiceAgentRow;
  client: GrattageInvoiceClientRow;
  /** Present on `show()`; absent on `index()` rows. */
  sales?: GrattageInvoiceSaleRow[];
};

/** `index()`'s envelope — the raw Laravel paginator, unwrapped by no Resource. */
type GrattageInvoicesEnvelope = {
  success: boolean;
  data: {
    data: GrattageInvoiceRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

/** `show()`/`cancel()`'s envelope — a single raw model under `data`. */
type GrattageInvoiceEnvelope = {
  success: boolean;
  message?: string;
  data: GrattageInvoiceRow;
};

function toSaleLine(row: GrattageInvoiceSaleRow): GrattageInvoiceSaleLine {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    total: row.total,
  };
}

function toGrattageInvoice(row: GrattageInvoiceRow): GrattageInvoice {
  return {
    id: row.id,
    status: row.status,
    totalAmount: row.total_amount,
    soldAt: row.sold_at,
    dueAt: row.due_at,
    declaredAt: row.declared_at,
    agentId: row.agent.id,
    agentName: `${row.agent.prenom} ${row.agent.nom}`,
    agentAccountNumber: row.agent.num_compte,
    clientId: row.client.id,
    clientPhone: row.client.phone,
    depositId: row.deposit_id,
    sales: row.sales?.map(toSaleLine),
  };
}

export async function fetchGrattageInvoices(
  params: GrattageInvoiceListParams,
): Promise<Paginated<GrattageInvoice>> {
  const { data } = await httpClient.get<GrattageInvoicesEnvelope>(
    "/admin/grattage-invoices",
    {
      params: {
        page: params.page,
        // Omitted rather than sent empty — `index()`'s own validator is
        // `nullable`, and an empty/"" value would just make the URL lie
        // about what is being filtered (same discipline every other
        // domain's own mapper already applies).
        ...(params.status ? { status: params.status } : {}),
        ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
        ...(params.dateTo ? { date_to: params.dateTo } : {}),
      },
    },
  );

  const page = data.data;
  return {
    items: page.data.map(toGrattageInvoice),
    page: page.current_page,
    perPage: page.per_page,
    total: page.total,
    lastPage: page.last_page,
  };
}

/**
 * `GET /admin/grattage-invoices/{id}` — `access-dashboard`, the same
 * coarse permission the list carries (see `registry.ts`'s own
 * `ACCESS_DASHBOARD` docblock for why no dedicated Grattage permission is
 * registered).
 */
export async function fetchGrattageInvoiceById(id: number): Promise<GrattageInvoice> {
  const { data } = await httpClient.get<GrattageInvoiceEnvelope>(
    `/admin/grattage-invoices/${id}`,
  );
  return toGrattageInvoice(data.data);
}

/**
 * `PUT /admin/grattage-invoices/{id}/cancel` — NO REQUEST BODY (verified
 * from source: `GrattageInvoiceController::cancel` reads nothing from the
 * request; unlike Bons' own cancel, there is no `cancellation_reason`
 * field on this backend at all). Routes through
 * `SalesService::cancelSale()` — stock-safe (restores the commercial's
 * inventory), irreversible.
 *
 * The ONLY documented failure is `GrattageSaleNotCancellable` (409, `{
 * success: false, message, error }` — NO `code` field, verified from
 * source). `normalizeError` therefore classifies it `kind: "unknown"`,
 * the same shape class as BC-X — handled by the dialog's own generic
 * error copy, not a registered error code.
 */
export async function cancelGrattageInvoice(id: number): Promise<GrattageInvoice> {
  const { data } = await httpClient.put<GrattageInvoiceEnvelope>(
    `/admin/grattage-invoices/${id}/cancel`,
  );
  return toGrattageInvoice(data.data);
}
