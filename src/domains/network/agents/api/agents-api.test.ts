import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { activateAgent, blockAgent, fetchAgent } from "./agents-api";

const API = "http://localhost/api/v1";

/**
 * A plain, no-React unit test of the mapper — mirrors
 * `grattage-outstanding-api.test.ts`'s own shape: this module's page test
 * (`agent-workspace-page.test.tsx`) covers rendering, this file covers the
 * wire-to-domain mapping in isolation, one call at a time.
 */

const managerRow = {
  id: 5,
  nom: "Idrissi",
  prenom: "Youssef",
  status: "active" as const,
  num_cin: "CIN005",
  num_ice: "ICE005",
  num_abonnement: "AB-005",
  num_compte: "MG0005",
  ville: "Casablanca",
  adresse: "12 Rue Mohammed V",
  date_ajouter: "2026-01-15T09:30:00.000000Z",
  photo_url: "https://example.test/photo.jpg",
  photo_cin_recto_url: "https://example.test/cin-recto.jpg",
  photo_cin_verso_url: "https://example.test/cin-verso.jpg",
  carte_auto_entrepreneur_url: null,
  certificat_habitat_url: null,
  fiche_antroprometrique_url: null,
  fiche_incident_bancaire_url: null,
  ville_sous_responsabilite: "Grand Casablanca",
  ville_actuelle: null,
  secteur: null,
  manager: null,
};

const commercialRow = {
  id: 12,
  nom: "Alaoui",
  prenom: "Sara",
  status: "active" as const,
  num_cin: "CIN012",
  num_ice: null,
  num_abonnement: null,
  num_compte: "CM0012",
  ville: null,
  adresse: null,
  date_ajouter: "2026-02-01T14:00:00.000000Z",
  photo_url: null,
  photo_cin_recto_url: null,
  photo_cin_verso_url: null,
  carte_auto_entrepreneur_url: null,
  certificat_habitat_url: null,
  fiche_antroprometrique_url: null,
  fiche_incident_bancaire_url: null,
  ville_sous_responsabilite: null,
  ville_actuelle: "Rabat",
  secteur: "Agdal",
  manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
};

function showHandler(id: number, role: "manager" | "commercial", agent: object) {
  return http.get(`${API}/admin/agents/${id}`, () =>
    HttpResponse.json({ success: true, role, agent }),
  );
}

describe("fetchAgent", () => {
  it("maps a manager's response, with role-specific fields and no commercial-only fields", async () => {
    server.use(showHandler(5, "manager", managerRow));

    const result = await fetchAgent(5);

    expect(result).toEqual({
      id: 5,
      nom: "Idrissi",
      prenom: "Youssef",
      status: "active",
      numCin: "CIN005",
      numIce: "ICE005",
      numAbonnement: "AB-005",
      numCompte: "MG0005",
      ville: "Casablanca",
      adresse: "12 Rue Mohammed V",
      dateAjout: "2026-01-15T09:30:00.000000Z",
      photoUrl: "https://example.test/photo.jpg",
      photoCinRectoUrl: "https://example.test/cin-recto.jpg",
      photoCinVersoUrl: "https://example.test/cin-verso.jpg",
      carteAutoEntrepreneurUrl: null,
      certificatHabitatUrl: null,
      ficheAntroprometriqueUrl: null,
      ficheIncidentBancaireUrl: null,
      role: "manager",
      villeSousResponsabilite: "Grand Casablanca",
    });
    expect(result).not.toHaveProperty("villeActuelle");
    expect(result).not.toHaveProperty("secteur");
    expect(result).not.toHaveProperty("manager");
  });

  it("maps a commercial's response, reducing the nested manager relation to {id, nom, prenom}", async () => {
    server.use(showHandler(12, "commercial", commercialRow));

    const result = await fetchAgent(12);

    expect(result).toEqual({
      id: 12,
      nom: "Alaoui",
      prenom: "Sara",
      status: "active",
      numCin: "CIN012",
      numIce: null,
      numAbonnement: null,
      numCompte: "CM0012",
      ville: null,
      adresse: null,
      dateAjout: "2026-02-01T14:00:00.000000Z",
      photoUrl: null,
      photoCinRectoUrl: null,
      photoCinVersoUrl: null,
      carteAutoEntrepreneurUrl: null,
      certificatHabitatUrl: null,
      ficheAntroprometriqueUrl: null,
      ficheIncidentBancaireUrl: null,
      role: "commercial",
      villeActuelle: "Rabat",
      secteur: "Agdal",
      manager: { id: 5, nom: "Idrissi", prenom: "Youssef" },
    });
    expect(result).not.toHaveProperty("villeSousResponsabilite");
  });

  it("maps a commercial with no assigned manager to manager: null", async () => {
    server.use(showHandler(12, "commercial", { ...commercialRow, manager: null }));

    const result = await fetchAgent(12);

    expect(result.role).toBe("commercial");
    if (result.role === "commercial") {
      expect(result.manager).toBeNull();
    }
  });

  it("requests the exact agent endpoint, by numeric id", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/agents/9`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ success: true, role: "manager", agent: managerRow });
      }),
    );

    await fetchAgent(9);

    expect(url?.pathname).toBe("/api/v1/admin/agents/9");
  });
});

describe("blockAgent / activateAgent", () => {
  it("PUTs the block endpoint", async () => {
    let method: string | undefined;
    server.use(
      http.put(`${API}/admin/agents/5/block`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await blockAgent(5);

    expect(method).toBe("PUT");
  });

  it("PUTs the activate endpoint", async () => {
    let method: string | undefined;
    server.use(
      http.put(`${API}/admin/agents/5/activate`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await activateAgent(5);

    expect(method).toBe("PUT");
  });
});
