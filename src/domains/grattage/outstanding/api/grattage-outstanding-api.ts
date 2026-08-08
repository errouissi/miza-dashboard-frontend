import { httpClient } from "@/infrastructure/http";
import type { GrattageOutstanding } from "../model/grattage-outstanding";

/**
 * `GET /admin/agents/{id}/grattage-outstanding` — `access-dashboard`
 * (same coarse permission as Grattage Invoices, verified fresh from
 * source this phase). NO PAGINATION — a bounded, complete set for one
 * agent, not a browsing endpoint (docblock, backend). Read-only; no
 * locks, no writes, no side effects.
 *
 * ACCEPTS OPTIONAL `status`/`sort_by`/`sort_dir` DISPLAY FILTERS SERVER-
 * SIDE (never sent here) — no UI consumes them yet (M6 Phase 2 has no
 * page), so they are deliberately omitted rather than exposed ahead of a
 * real caller. Add them to this function's own params only once a real
 * consumer (M7 Agent 360) needs to send one.
 *
 * A UX HINT / DISPLAY SNAPSHOT ONLY, NEVER AUTHORITATIVE — same caution
 * `deposits-api.ts`'s own `fetchGrattageOutstanding` already carries:
 * `DepositService::createGrattageReconciliation` recomputes the real
 * outstanding total UNDER LOCK at submission time; this unlocked read can
 * go stale between load and any action a future caller takes from it.
 */
type GrattageOutstandingEnvelope = {
  success: boolean;
  data: {
    agent: {
      id: number;
      nom: string;
      prenom: string;
      num_cin: string;
      num_compte: string;
      role: string;
      status: string;
      manager: { id: number; nom: string; prenom: string } | null;
    };
    summary: {
      required_total: string;
      pending_total: string;
      overdue_total: string;
      invoice_count: number;
      oldest_due_at: string | null;
    };
    restock_gate: {
      blocked: boolean;
      reason: "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE" | null;
    };
    invoices: {
      id: number;
      status: "pending" | "overdue";
      total_amount: string;
      sold_at: string;
      due_at: string;
      declared_at: string | null;
      days_overdue: number | null;
    }[];
  };
};

function toGrattageOutstanding(
  data: GrattageOutstandingEnvelope["data"],
): GrattageOutstanding {
  return {
    agent: {
      id: data.agent.id,
      nom: data.agent.nom,
      prenom: data.agent.prenom,
      numCin: data.agent.num_cin,
      numCompte: data.agent.num_compte,
      role: data.agent.role,
      status: data.agent.status,
      manager: data.agent.manager,
    },
    summary: {
      requiredTotal: data.summary.required_total,
      pendingTotal: data.summary.pending_total,
      overdueTotal: data.summary.overdue_total,
      invoiceCount: data.summary.invoice_count,
      oldestDueAt: data.summary.oldest_due_at,
    },
    restockGate: {
      blocked: data.restock_gate.blocked,
      reason: data.restock_gate.reason,
    },
    invoices: data.invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      totalAmount: invoice.total_amount,
      soldAt: invoice.sold_at,
      dueAt: invoice.due_at,
      declaredAt: invoice.declared_at,
      daysOverdue: invoice.days_overdue,
    })),
  };
}

export async function fetchGrattageOutstanding(
  agentId: number,
): Promise<GrattageOutstanding> {
  const { data } = await httpClient.get<GrattageOutstandingEnvelope>(
    `/admin/agents/${agentId}/grattage-outstanding`,
  );
  return toGrattageOutstanding(data.data);
}
