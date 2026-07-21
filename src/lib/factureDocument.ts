// src/lib/factureDocument.ts
//
// Construction des données d'affichage de la facture, isolée de leur
// rendu (FacturePreview.tsx) — même principe que buildTicketData()
// (src/lib/ticket.ts) pour le ticket de dépôt. buildFactureDocument()
// est pure (testable sans DOM). Un futur générateur PDF réel consommera
// la même FactureDocumentData sans toucher à FacturePreview ni à cette
// fonction : url_pdf reste null pour cette V1 (aperçu écran uniquement).
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
  // Détail du pressage facturé — null seulement si le dépôt d'origine a
  // été inaccessible (ne devrait pas arriver en pratique, RLS mis à part).
  pressage: {
    numeroTicket: string;
    poidsOlivesKg: number;
    quantiteHuileKg: number | null;
    rendementFinal: number | null;
    dateDepotIso: string;
  } | null;
  reglements: { dateIso: string; montant: number; mode: string; note: string | null }[];
}

/**
 * Construit les données de l'aperçu facture à partir d'une facture déjà
 * chargée avec ses relations (client, pressage/dépôt, règlements). Le
 * nom de l'huilerie est passé en paramètre plutôt que résolu ici, pour
 * ne pas coupler cette fonction à la forme exacte des requêtes Supabase
 * — même choix que buildTicketData().
 */
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
