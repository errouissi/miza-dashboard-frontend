import { httpClient } from "@/infrastructure/http";
import type { Agent, AgentManagerSummary, AgentStatus } from "../model/agent";

/**
 * The Agent endpoints and their mappers (FTA §7, D-6).
 *
 *   show     { success, role, agent: <raw Agent model + appended *_url fields
 *              (+ moto if present) + manager (raw nested Agent, commercial
 *              only), *_path fields stripped> }   GET
 *   block    { success, message, data: <agent> }                    PUT
 *   activate { success, message, data: <agent> }                    PUT
 *
 * `role` at the TOP LEVEL is the discriminator this mapper reads — `agent.role`
 * carries the identical value (verified from source, `AgentController::show`),
 * so either would work; the top-level one is used because it is the field the
 * controller clearly intends as the discriminator.
 */

/** The manager relation exactly as the raw wire nests it — a full raw Agent, reduced at the mapper boundary (see `model/agent.ts`). */
type RawManagerRelation = {
  id: number;
  nom: string;
  prenom: string;
};

/**
 * The wire row this mapper actually reads — a NARROW slice of `show()`'s full
 * raw-model payload (ADR-0008: model only what a screen reads). The real
 * response carries every financial column, `moto`, and both Laravel
 * timestamps too; none of that is typed here because Phase 1 renders none of
 * it.
 */
type AgentRow = {
  id: number;
  nom: string;
  prenom: string;
  status: AgentStatus;
  num_cin: string;
  num_ice: string | null;
  num_abonnement: string | null;
  num_compte: string;
  ville: string | null;
  adresse: string | null;
  /** The `date_ajouter` compatibility accessor — a bare passthrough of `date_ajout`, no reformatting. Full ISO datetime. */
  date_ajouter: string | null;
  photo_url: string | null;
  photo_cin_recto_url: string | null;
  photo_cin_verso_url: string | null;
  carte_auto_entrepreneur_url: string | null;
  certificat_habitat_url: string | null;
  fiche_antroprometrique_url: string | null;
  fiche_incident_bancaire_url: string | null;
  // Manager-only on the wire (always null for a commercial):
  ville_sous_responsabilite: string | null;
  // Commercial-only on the wire (always null for a manager):
  ville_actuelle: string | null;
  secteur: string | null;
  manager: RawManagerRelation | null;
};

type ShowAgentEnvelope = {
  success: boolean;
  role: "manager" | "commercial";
  agent: AgentRow;
};

function toManagerSummary(raw: RawManagerRelation | null): AgentManagerSummary | null {
  if (!raw) return null;
  return { id: raw.id, nom: raw.nom, prenom: raw.prenom };
}

function toAgent(role: "manager" | "commercial", row: AgentRow): Agent {
  const common = {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    status: row.status,
    numCin: row.num_cin,
    numIce: row.num_ice,
    numAbonnement: row.num_abonnement,
    numCompte: row.num_compte,
    ville: row.ville,
    adresse: row.adresse,
    dateAjout: row.date_ajouter,
    photoUrl: row.photo_url,
    photoCinRectoUrl: row.photo_cin_recto_url,
    photoCinVersoUrl: row.photo_cin_verso_url,
    carteAutoEntrepreneurUrl: row.carte_auto_entrepreneur_url,
    certificatHabitatUrl: row.certificat_habitat_url,
    ficheAntroprometriqueUrl: row.fiche_antroprometrique_url,
    ficheIncidentBancaireUrl: row.fiche_incident_bancaire_url,
  };

  if (role === "manager") {
    return {
      ...common,
      role: "manager",
      villeSousResponsabilite: row.ville_sous_responsabilite,
    };
  }

  return {
    ...common,
    role: "commercial",
    villeActuelle: row.ville_actuelle,
    secteur: row.secteur,
    manager: toManagerSummary(row.manager),
  };
}

export async function fetchAgent(id: number): Promise<Agent> {
  const { data } = await httpClient.get<ShowAgentEnvelope>(`/admin/agents/${id}`);
  return toAgent(data.role, data.agent);
}

/**
 * Blocks an account. 400s if it is ALREADY blocked — the same endpoint
 * `Manager`'s/`Commercial`'s own `blockManager`/`blockCommercial` call, hit
 * again here rather than imported (both are private to their own domains;
 * see ADR-0012 and the M7 Phase 1 discovery pass for why this is a fresh,
 * parallel implementation, not a workaround).
 */
export async function blockAgent(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/block`);
}

/** Activates an account. 400s if it is ALREADY active — same reasoning as above. */
export async function activateAgent(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/activate`);
}
