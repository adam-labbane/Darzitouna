import type { FactureWithRelations } from "../types/facture";
import { computeResteDu } from "./factureCalculations";

export interface FactureDocumentData {
  huilerieNom: string;
  numeroFacture: string;
  dateFactureIso: string;
  clientNom: string;
  statut: FactureWithRelations["statut_paiement"];
  montantTtc: number;
  resteDu: number;
  pressage: {
    numeroTicket: string;
    poidsOlivesKg: number;
    quantiteHuileKg: number | null;
    rendementFinal: number | null;
    dateDepotIso: string;
  } | null;
  reglements: { dateIso: string; montant: number; mode: string; note: string | null }[];
}

export function buildFactureDocument(
  facture: FactureWithRelations,
  huilerieNom: string,
): FactureDocumentData {
  return {
    huilerieNom,
    numeroFacture: facture.numero_facture,
    dateFactureIso: facture.created_at,
    clientNom: facture.client?.nom_complet ?? "Client inconnu",
    statut: facture.statut_paiement,
    montantTtc: facture.montant_ttc,
    resteDu: computeResteDu(facture.montant_ttc, facture.reglement),
    pressage: facture.pressage?.depot
      ? {
          numeroTicket: facture.pressage.depot.numero_ticket,
          poidsOlivesKg: facture.pressage.depot.poids_olives_kg,
          quantiteHuileKg: facture.pressage.quantite_huile_kg,
          rendementFinal: facture.pressage.rendement_final,
          dateDepotIso: facture.pressage.depot.date_depot,
        }
      : null,
    reglements: facture.reglement.map((r) => ({
      dateIso: r.date_reglement,
      montant: r.montant,
      mode: r.mode,
      note: r.note,
    })),
  };
}
