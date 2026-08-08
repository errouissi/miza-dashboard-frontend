import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { httpClient } from "@/infrastructure/http";
import {
  activateAgent,
  blockAgent,
  fetchAgent,
  fetchCommercialStockQuantity,
  updateAgent,
  type UpdateAgentInput,
} from "./agents-api";

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
  salaire: "3000.00",
  montant_essence: "0.00",
  montant_declaration_cnss: "1500.00",
  charge_auto_entrepreneur: "200.00",
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
  salaire: "0.00",
  montant_essence: "0.00",
  montant_declaration_cnss: "0.00",
  charge_auto_entrepreneur: "0.00",
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
      salaire: "3000.00",
      montantEssence: "0.00",
      montantDeclarationCnss: "1500.00",
      chargeAutoEntrepreneur: "200.00",
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
      salaire: "0.00",
      montantEssence: "0.00",
      montantDeclarationCnss: "0.00",
      chargeAutoEntrepreneur: "0.00",
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

const managerInput: UpdateAgentInput = {
  role: "manager",
  nom: "Idrissi",
  prenom: "Youssef",
  ville: "Casablanca",
  adresse: "12 Rue Mohammed V",
  numCin: "CIN005",
  numIce: "ICE005",
  numAbonnement: "AB-005",
  salaire: "3000",
  montantEssence: "150.5",
  montantDeclarationCnss: "1500",
  chargeAutoEntrepreneur: "200",
  villeSousResponsabilite: "Grand Casablanca",
};

const commercialInput: UpdateAgentInput = {
  role: "commercial",
  nom: "Alaoui",
  prenom: "Sara",
  ville: "Rabat",
  adresse: "3 Avenue Hassan II",
  numCin: "CIN012",
  numIce: "ICE012",
  numAbonnement: "AB-012",
  salaire: "0",
  montantEssence: "0",
  montantDeclarationCnss: "0",
  chargeAutoEntrepreneur: "0",
  villeActuelle: "Rabat",
  secteur: "Agdal",
  managerId: 5,
};

describe("updateAgent", () => {
  it("POSTs (not PUT) multipart form data to /admin/agents/{id}", async () => {
    let method: string | undefined;
    let contentType: string | null = null;
    server.use(
      http.post(`${API}/admin/agents/5`, ({ request }) => {
        method = request.method;
        contentType = request.headers.get("content-type");
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await updateAgent(5, managerInput);

    expect(method).toBe("POST");
    expect(contentType).toMatch(/^multipart\/form-data/);
  });

  it("sends every common field, using the API's own wire spellings", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await updateAgent(5, managerInput);

    expect(body?.get("nom")).toBe("Idrissi");
    expect(body?.get("prenom")).toBe("Youssef");
    expect(body?.get("ville")).toBe("Casablanca");
    expect(body?.get("adresse")).toBe("12 Rue Mohammed V");
    expect(body?.get("num_cin")).toBe("CIN005");
    expect(body?.get("num_ice")).toBe("ICE005");
    expect(body?.get("num_d_abonnement")).toBe("AB-005");
    expect(body?.get("salaire")).toBe("3000");
    expect(body?.get("montant_essence")).toBe("150.5");
    expect(body?.get("montant_declaration_cnss")).toBe("1500");
    expect(body?.get("charge_auto_entrepreneur")).toBe("200");
  });

  it("sends ville_sous_responsabilite for a manager, and no commercial-only field", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await updateAgent(5, managerInput);

    expect(body?.get("ville_sous_responsabilite")).toBe("Grand Casablanca");
    expect(body?.has("ville_actuelle")).toBe(false);
    expect(body?.has("secteur")).toBe(false);
    expect(body?.has("manager_id")).toBe(false);
  });

  it("sends ville_actuelle and secteur for a commercial, and no manager-only field", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/12`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: commercialRow });
      }),
    );

    await updateAgent(12, commercialInput);

    expect(body?.get("ville_actuelle")).toBe("Rabat");
    expect(body?.get("secteur")).toBe("Agdal");
    expect(body?.has("ville_sous_responsabilite")).toBe(false);
  });

  it("sends manager_id for a commercial (M7 Agent 360 completion item)", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/12`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: commercialRow });
      }),
    );

    await updateAgent(12, commercialInput);

    expect(body?.get("manager_id")).toBe("5");
  });

  it("never sends status, manager_id, moto fields, or the legacy identity/password aliases", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await updateAgent(5, managerInput);

    for (const forbidden of [
      "status",
      "manager_id",
      "type_moto",
      "num_de_chassis",
      "cart_grise_recto",
      "cart_grise_verso",
      "assurance",
      "engagement_moto",
      "num_de_compte",
      "date_ajouter",
      "mdp",
    ]) {
      expect(body?.has(forbidden)).toBe(false);
    }
  });

  it("sends no file key at all when no replacement was selected — preserves the existing files", async () => {
    let body: FormData | undefined;
    server.use(
      http.post(`${API}/admin/agents/5`, async ({ request }) => {
        body = await request.formData();
        return HttpResponse.json({ success: true, message: "ok", data: managerRow });
      }),
    );

    await updateAgent(5, managerInput, {});

    for (const fileField of [
      "photo",
      "photo_cin_recto",
      "photo_cin_verso",
      "certificat_d_habitat",
      "carte_auto_entrepreneur",
      "fiche_antroprometrique",
      "fiche_d_incident_banquaire",
    ]) {
      expect(body?.has(fileField)).toBe(false);
    }
  });

  // A `FormData` carrying a real `File` hangs indefinitely if inspected via
  // MSW's own `request.formData()` under this jsdom setup — the same,
  // empirically-verified gotcha `create-cheque-page.test.tsx`'s own
  // docblock documents. Spy on `httpClient.post` directly instead, exactly
  // that file's established fix, rather than reaching for MSW here.
  describe("with a real File attached", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("sends only the file(s) actually replaced, under their own wire names", async () => {
      const postSpy = vi
        .spyOn(httpClient, "post")
        .mockResolvedValue({ data: { success: true, message: "ok", data: managerRow } });

      const newPhoto = new File(["binary"], "new-photo.png", { type: "image/png" });
      await updateAgent(5, managerInput, { photo: newPhoto });

      expect(postSpy).toHaveBeenCalled();
      const [url, body] = postSpy.mock.calls[0] as [string, FormData];
      expect(url).toBe("/admin/agents/5");
      expect(body.get("photo")).toBeInstanceOf(File);
      expect((body.get("photo") as File).name).toBe("new-photo.png");
      expect(body.has("photo_cin_recto")).toBe(false);
      expect(body.has("certificat_d_habitat")).toBe(false);
    });
  });
});

describe("fetchCommercialStockQuantity (M7 Agent 360 completion item)", () => {
  it("maps the flat { stock_quantity } envelope verbatim", async () => {
    server.use(
      http.get(`${API}/admin/agents/12/stock-quantity`, () =>
        HttpResponse.json({ stock_quantity: 7 }),
      ),
    );

    const result = await fetchCommercialStockQuantity(12);

    expect(result).toBe(7);
  });

  it("requests the exact commercial id", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/agents/12/stock-quantity`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ stock_quantity: 0 });
      }),
    );

    await fetchCommercialStockQuantity(12);

    expect(url?.pathname).toBe("/api/v1/admin/agents/12/stock-quantity");
  });
});
