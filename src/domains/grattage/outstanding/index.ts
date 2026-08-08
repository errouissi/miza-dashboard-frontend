export {
  useGrattageOutstandingQuery,
  useGrattageRestockGateQuery,
} from "./queries/grattage-outstanding-queries";
export type {
  GrattageOutstanding,
  GrattageOutstandingInvoice,
  GrattageRestockGate,
  GrattageRestockGateReason,
} from "./model/grattage-outstanding";

// api/, model/'s other exports (`GrattageOutstandingAgent`,
// `GrattageOutstandingManager`, `GrattageOutstandingSummary`) and
// queries/keys.ts stay internal — no caller reads them directly (ADR-0008).
//
// `useGrattageRestockGateQuery` remains the ONE sanctioned domain→domain
// HOOK export in the app (FTA §4, mechanism 2) — `AgentTransferDetailPage`
// is its only consumer (ADR-0027/0028).
//
// `useGrattageOutstandingQuery` is promoted from private to public THIS
// PHASE (M7 Phase 3, per ADR-0026's own anticipated consequence): Agent
// 360's `AgentOutstandingPanel` is mechanism 1 (composition at the page),
// not a second domain→domain hook import — Network imports Grattage's own
// public surface, Grattage still knows nothing about Network. No new
// api/model/queries file was added; this is purely a widened export.
