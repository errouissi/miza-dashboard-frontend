import { httpClient } from "@/infrastructure/http";

/**
 * `GET /admin/managers/{manager}/stock` — verified fresh from source
 * (`AgentController::stock`), added specifically to give Agent Transfer's
 * own "add line" product picker a real source of truth for availability.
 *
 * A FLAT JSON ARRAY, NOT AN ENVELOPE — same shape discipline as
 * `GET /admin/companies/{company}/stock` (Allocations' own equivalent,
 * added the same phase).
 *
 * ALREADY FILTERED TO `available_quantity > 0` SERVER-SIDE
 * (`AgentController::stock` filters out zero-quantity rows before
 * responding) — this is now THE backend source of truth for "can this
 * product actually be transferred from this manager right now"; the
 * picker built from this response can never offer a product with no
 * stock.
 *
 * 404s IF THE AGENT IS NOT A MANAGER (`abort_if($manager->role !== 'manager',
 * 404)`) — not reachable through this UI: `agentTransfer.managerId` always
 * identifies a real manager by construction (`StoreAgentTransferRequest`'s
 * own `exists:agents,id` where `role=manager`).
 *
 * KEPT INSIDE THIS DOMAIN (`stock/agent-transfers/`), NOT Managers' own
 * Network module — this read exists because of AGENT TRANSFER'S OWN "add
 * line" picker, the same reasoning `agent-sub-data-api.ts` (this domain's
 * own Manager→Commercial cascade read) is already domain-local rather than
 * living in Network's Managers/Commercials (ADR-0021's reasoning class).
 */
export type ManagerStockItem = {
  productId: number;
  name: string;
  operator: string;
  value: number;
  availableQuantity: number;
};

type ManagerStockRow = {
  product_id: number;
  name: string;
  operator: string;
  value: number;
  available_quantity: number;
};

export async function fetchManagerStock(managerId: number): Promise<ManagerStockItem[]> {
  const { data } = await httpClient.get<ManagerStockRow[]>(
    `/admin/managers/${managerId}/stock`,
  );
  return data.map((row) => ({
    productId: row.product_id,
    name: row.name,
    operator: row.operator,
    value: row.value,
    availableQuantity: row.available_quantity,
  }));
}
