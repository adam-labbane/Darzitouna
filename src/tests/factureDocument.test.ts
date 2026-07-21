import { describe, expect, it } from "vitest";
import { buildFactureDocument } from "../lib/factureDocument";
import type { FactureWithRelations } from "../types/facture";

const baseFacture: FactureWithRelations = {
  id: "facture-1",
  saison_id: "saison-1",
  client_id: "client-1",
  pressage_id: "pressage-1",
  numero_facture: "FAC-2026-0001",
  url_pdf: null,
  montant_ttc: 25,
  statut_paiement: "PARTIEL",
  created_at: "2026-07-21T10:00:00.000Z",
  client: { nom_complet: "Ali Ben Salah" },
  pressage: {
    id: "pressage-1",
    quantite_huile_kg: 18,
    rendement_final: 18,
    depot: {
      numero_ticket: "TK-2026-0001",
      poids_olives_kg: 100,
      date_depot: "2026-07-20T09:00:00.000Z",
    },
  },
  reglement: [{ id: "r1", facture_id: "facture-1", date_reglement: "2026-07-21T11:00:00.000Z", montant: 10, mode: "ESPECES", note: null }],
};

describe("buildFactureDocument", () => {
  it("reprend numéro, client, statut et montant de la facture", () => {
    const doc = buildFactureDocument(baseFacture, "Huilerie Mohamed");

    expect(doc.numeroFacture).toBe("FAC-2026-0001");
    expect(doc.clientNom).toBe("Ali Ben Salah");
    expect(doc.huilerieNom).toBe("Huilerie Mohamed");
    expect(doc.statut).toBe("PARTIEL");
    expect(doc.montantTtc).toBe(25);
  });

  it("calcule le reste dû à partir des règlements embarqués", () => {
    const doc = buildFactureDocument(baseFacture, "Huilerie Mohamed");
    expect(doc.resteDu).toBe(15);
  });

  it("reprend le détail du pressage/dépôt d'origine", () => {
    const doc = buildFactureDocument(baseFacture, "Huilerie Mohamed");
    expect(doc.pressage).toEqual({
      numeroTicket: "TK-2026-0001",
      poidsOlivesKg: 100,
      quantiteHuileKg: 18,
      rendementFinal: 18,
      dateDepotIso: "2026-07-20T09:00:00.000Z",
    });
  });

  it("client inconnu si la jointure client est absente", () => {
    const doc = buildFactureDocument({ ...baseFacture, client: null }, "Huilerie Mohamed");
    expect(doc.clientNom).toBe("Client inconnu");
  });

  it("pressage null si le dépôt d'origine est absent", () => {
    const doc = buildFactureDocument(
      { ...baseFacture, pressage: { id: "pressage-1", quantite_huile_kg: 18, rendement_final: 18, depot: null } },
      "Huilerie Mohamed",
    );
    expect(doc.pressage).toBeNull();
  });

  it("liste les règlements avec date/montant/mode/note", () => {
    const doc = buildFactureDocument(baseFacture, "Huilerie Mohamed");
    expect(doc.reglements).toEqual([
      { dateIso: "2026-07-21T11:00:00.000Z", montant: 10, mode: "ESPECES", note: null },
    ]);
  });
});
