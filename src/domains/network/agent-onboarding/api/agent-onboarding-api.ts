import { httpClient } from "@/infrastructure/http";
import { parseMoney } from "@/shared/formatters";
import type { AgentOnboardingFormValues } from "../model/agent-onboarding";

/**
 * `AgentController::store` (FTA §7, D-6) — `POST /admin/agents`.
 *
 * THE FIRST NON-JSON REQUEST BODY IN THIS PRODUCT: file uploads are mandatory
 * on create, so this is `multipart/form-data`, not a plain object. `axios`
 * (via `httpClient`) sets the multipart boundary itself from a `FormData`
 * instance — no header, no interceptor change needed.
 *
 * THE SUCCESS RESPONSE CARRIES BACKEND-GENERATED CREDENTIALS, verified from
 * source, not assumed: `generateAccountNumber()` (`MG#####`/`CM#####`,
 * sequential per role) and `generatePassword()` (an 8-char random string) are
 * both computed server-side. There is no field anywhere in this form for
 * either. `credentials.password` is shown ONCE, in this response — `Agent`
 * hides `password` (`$hidden`) on every subsequent read, so a caller that
 * does not display it here has lost it permanently.
 */

type CreateAgentEnvelope = {
  success: boolean;
  message: string;
  data: {
    agent: {
      id: number;
      nom: string;
      prenom: string;
      role: "manager" | "commercial";
      num_compte: string;
    };
    credentials: {
      num_de_compte: string;
      password: string;
    };
  };
};

export type CreateAgentResult = {
  agent: {
    id: number;
    nom: string;
    prenom: string;
    role: "manager" | "commercial";
    numDeCompte: string;
  };
  credentials: {
    numDeCompte: string;
    password: string;
  };
};

/**
 * Builds the exact multipart payload `store()` expects — wire field names
 * verified from source, not guessed. Only the SELECTED role's optional
 * fields are sent; the backend force-nulls the other role's fields anyway
 * (confirmed from source), but sending only what applies keeps the request
 * honest about intent.
 */
function buildFormData(values: AgentOnboardingFormValues): FormData {
  const formData = new FormData();

  formData.append("role", values.role);
  formData.append("nom", values.nom.trim());
  formData.append("prenom", values.prenom.trim());
  formData.append("ville", values.ville.trim());
  formData.append("adresse", values.adresse.trim());
  formData.append("num_cin", values.numCin.trim());
  formData.append("num_ice", values.numIce.trim());

  if (values.role === "manager") {
    if (values.villeSousResponsabilite?.trim()) {
      formData.append("ville_sous_responsabilite", values.villeSousResponsabilite.trim());
    }
  } else {
    if (values.managerId) formData.append("manager_id", values.managerId);
    if (values.villeActuelle?.trim()) {
      formData.append("ville_actuelle", values.villeActuelle.trim());
    }
    if (values.secteur?.trim()) formData.append("secteur", values.secteur.trim());
  }

  // Required files — zod's superRefine already guarantees these are non-null
  // by the time handleSubmit's onSubmit callback runs.
  formData.append("photo", values.photo as File);
  formData.append("photo_cin_recto", values.photoCinRecto as File);
  formData.append("photo_cin_verso", values.photoCinVerso as File);
  formData.append("certificat_d_habitat", values.certificatDHabitat as File);
  formData.append("carte_auto_entrepreneur", values.carteAutoEntrepreneur as File);
  if (values.ficheAntroprometrique) {
    formData.append("fiche_antroprometrique", values.ficheAntroprometrique);
  }
  if (values.ficheDIncidentBanquaire) {
    formData.append("fiche_d_incident_banquaire", values.ficheDIncidentBanquaire);
  }

  formData.append("num_d_abonnement", values.numDAbonnement.trim());
  formData.append("salaire", values.salaire.trim());
  // Sent as the PARSED number, not the raw operator-typed string — the
  // backend expects a plain numeric string, not French thousands grouping.
  formData.append("montant_essence", String(parseMoney(values.montantEssence) ?? 0));
  formData.append("montant_declaration_cnss", values.montantDeclarationCnss.trim());
  formData.append("charge_auto_entrepreneur", values.chargeAutoEntrepreneur.trim());

  // `filter_var(..., FILTER_VALIDATE_BOOLEAN)` server-side parses the literal
  // strings "true"/"false" correctly — see the model docblock and the
  // backend's own has_moto truthy-bug fix comment.
  formData.append("has_moto", values.hasMoto ? "true" : "false");
  if (values.hasMoto) {
    formData.append("type_moto", values.typeMoto ?? "");
    formData.append("num_de_chassis", values.numDeChassis?.trim() ?? "");
    formData.append("cart_grise_recto", values.cartGriseRecto as File);
    formData.append("cart_grise_verso", values.cartGriseVerso as File);
    formData.append("assurance", values.assurance as File);
    formData.append("engagement_moto", values.engagementMoto as File);
  }

  return formData;
}

export async function createAgent(
  values: AgentOnboardingFormValues,
): Promise<CreateAgentResult> {
  const { data } = await httpClient.post<CreateAgentEnvelope>(
    "/admin/agents",
    buildFormData(values),
  );

  const { agent, credentials } = data.data;
  return {
    agent: {
      id: agent.id,
      nom: agent.nom,
      prenom: agent.prenom,
      role: agent.role,
      numDeCompte: agent.num_compte,
    },
    credentials: {
      numDeCompte: credentials.num_de_compte,
      password: credentials.password,
    },
  };
}
