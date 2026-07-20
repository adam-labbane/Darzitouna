// src/lib/ticket.ts
//
// Génération du contenu du ticket, isolée de l'acte d'impression.
// buildTicketData() est pure (testable sans DOM). TicketPrinter est une
// interface implémentée aujourd'hui par browserPrinter (impression
// navigateur) ; demain, une implémentation Bluetooth (Web Bluetooth API)
// pourra remplacer browserPrinter sans toucher à buildTicketData() ni aux
// composants qui l'utilisent (TicketPreview, DepotNouveau).
import type { Depot } from "../types/depot";

export interface TicketData {
  huilerieNom: string;
  numeroTicket: string;
  dateDepotIso: string;
  clientNom: string;
  poidsNetKg: number;
  isAchat: boolean;
  montantTotal?: number;
}

/**
 * Construit les données du ticket à partir d'un dépôt déjà créé. Fonction
 * pure : aucune dépendance à React, au DOM ou à un service d'impression —
 * clientNom et huilerieNom sont passés en paramètre plutôt que résolus
 * ici, pour ne pas coupler cette fonction à la forme exacte des requêtes
 * Supabase (jointures embarquées ou non).
 */
export function buildTicketData(depot: Depot, clientNom: string, huilerieNom: string): TicketData {
  const ticket: TicketData = {
    huilerieNom,
    numeroTicket: depot.numero_ticket,
    dateDepotIso: depot.date_depot,
    clientNom,
    poidsNetKg: depot.poids_olives_kg,
    isAchat: depot.is_achat_olives,
  };

  if (depot.is_achat_olives && depot.prix_achat_unitaire !== null) {
    ticket.montantTotal = depot.prix_achat_unitaire * depot.poids_olives_kg;
  }

  return ticket;
}

/**
 * Contrat d'impression : une seule méthode, indépendante du support
 * physique. Aujourd'hui implémentée par browserPrinter (fenêtre
 * d'impression du navigateur). Demain, une bluetoothPrinter utilisant
 * l'API Web Bluetooth implémentera la même interface — aucun appelant
 * n'aura besoin de changer, seul le choix de l'implémentation injectée
 * change.
 */
export interface TicketPrinter {
  print(ticket: TicketData): Promise<void>;
}

// Implémentation "aperçu" : déclenche l'impression standard du
// navigateur (imprimante classique connectée à la tablette/au PC, ou
// export PDF) — pas un simple stub, une vraie action utilisable dès
// aujourd'hui. Une feuille de style @media print (src/index.css)
// n'affiche que la zone marquée .print-ticket-area au moment d'imprimer.
export const browserPrinter: TicketPrinter = {
  async print() {
    window.print();
  },
};
