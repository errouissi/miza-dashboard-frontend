export { useGrattageRestockGateQuery } from "./queries/grattage-outstanding-queries";
export type {
  GrattageRestockGate,
  GrattageRestockGateReason,
} from "./model/grattage-outstanding";

// api/, model/'s other exports, queries/keys.ts and the private
// `useGrattageOutstandingQuery` stay internal (M6 Phase 2 decision — see
// `queries/grattage-outstanding-queries.ts`'s own docblock). This is the
// ONE sanctioned domain→domain hook export in the app (FTA §4, mechanism
// 2) — Stock imports `useGrattageRestockGateQuery` from here starting
// Phase 3; no other consumer should be added without a fresh ADR.
