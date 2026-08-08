import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import { createQueryClient } from "@/infrastructure/query";
import {
  useGrattageOutstandingQuery,
  useGrattageRestockGateQuery,
} from "./grattage-outstanding-queries";

const API = "http://localhost/api/v1";

/**
 * No page renders this module's hooks yet (M6 Phase 2 ships no UI) — this
 * codebase has no prior standalone query-hook test file, so this is a
 * deliberate, new-but-minimal pattern: `renderHook` + a real
 * `QueryClientProvider` (React Query's own standard testing approach),
 * exercised against the SAME MSW `server` every page test already shares.
 *
 * The one guarantee worth pinning here that a page test could never
 * isolate as cleanly: `useGrattageRestockGateQuery` and
 * `useGrattageOutstandingQuery` share ONE cache entry via `select` — not
 * two independent fetches. See `grattage-outstanding-queries.ts`'s own
 * docblock.
 */

/**
 * `restockGate` is a single required object, not two separately-defaulted
 * fields — `blocked: false, reason: null` is a real, valid combination
 * that `{blocked?, reason?}` defaults via `??` cannot express (an
 * explicit `null` and "not provided" are indistinguishable to `??`).
 */
function outstandingEnvelope(restockGate: {
  blocked: boolean;
  reason: "OUTSTANDING_GRATTAGE" | "TEAM_OUTSTANDING_GRATTAGE" | null;
}) {
  return {
    success: true,
    data: {
      agent: {
        id: 1,
        nom: "Alaoui",
        prenom: "Sara",
        num_cin: "CIN001",
        num_compte: "CM0001",
        role: "commercial",
        status: "active",
        manager: null,
      },
      summary: {
        required_total: "150.00",
        pending_total: "150.00",
        overdue_total: "0.00",
        invoice_count: 1,
        oldest_due_at: "2026-08-02T12:00:00.000000Z",
      },
      restock_gate: restockGate,
      invoices: [],
    },
  };
}

function wrapper(queryClient = createQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useGrattageRestockGateQuery", () => {
  it("resolves to exactly {blocked, reason} — never the full aggregate", async () => {
    server.use(
      http.get(`${API}/admin/agents/1/grattage-outstanding`, () =>
        HttpResponse.json(
          outstandingEnvelope({ blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
        ),
      ),
    );

    const { result } = renderHook(() => useGrattageRestockGateQuery(1), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      blocked: true,
      reason: "OUTSTANDING_GRATTAGE",
    });
    expect(Object.keys(result.current.data ?? {})).toEqual(["blocked", "reason"]);
  });

  it("resolves a clear gate — blocked false, reason null", async () => {
    server.use(
      http.get(`${API}/admin/agents/2/grattage-outstanding`, () =>
        HttpResponse.json(outstandingEnvelope({ blocked: false, reason: null })),
      ),
    );

    const { result } = renderHook(() => useGrattageRestockGateQuery(2), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ blocked: false, reason: null });
  });

  it("does not fetch while disabled", async () => {
    let called = false;
    server.use(
      http.get(`${API}/admin/agents/3/grattage-outstanding`, () => {
        called = true;
        return HttpResponse.json(
          outstandingEnvelope({ blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
        );
      }),
    );

    renderHook(() => useGrattageRestockGateQuery(3, { enabled: false }), {
      wrapper: wrapper(),
    });

    // Nothing to await for — a disabled query never transitions out of
    // "pending". A short settle is enough to prove no request fired.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(called).toBe(false);
  });
});

describe("useGrattageOutstandingQuery and useGrattageRestockGateQuery share one cache entry", () => {
  it("fires exactly one network request for the same agent, mounted together", async () => {
    let requestCount = 0;
    server.use(
      http.get(`${API}/admin/agents/1/grattage-outstanding`, () => {
        requestCount += 1;
        return HttpResponse.json(
          outstandingEnvelope({ blocked: true, reason: "OUTSTANDING_GRATTAGE" }),
        );
      }),
    );

    const queryClient = createQueryClient();
    const Wrapper = wrapper(queryClient);

    const full = renderHook(() => useGrattageOutstandingQuery(1), { wrapper: Wrapper });
    const gate = renderHook(() => useGrattageRestockGateQuery(1), { wrapper: Wrapper });

    await waitFor(() => expect(full.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(gate.result.current.isSuccess).toBe(true));

    expect(requestCount).toBe(1);
    expect(gate.result.current.data).toEqual(full.result.current.data?.restockGate);
  });
});
