import type { Depot } from "../types/depot";

export interface TicketData {
  huilerieNom: string;
  numeroTicket: string;
  dateDepotIso: string;
  clientNom: string;
  poidsNetKg: number;
  isAchat: boolean;
  montantTotal?: number;
  tokenPublic: string;
}

export function buildTicketData(depot: Depot, clientNom: string, huilerieNom: string): TicketData {
  const ticket: TicketData = {
    huilerieNom,
    numeroTicket: depot.numero_ticket,
    dateDepotIso: depot.date_depot,
    clientNom,
    poidsNetKg: depot.poids_olives_kg,
    isAchat: depot.is_achat_olives,
    tokenPublic: depot.token_public,
  };

  if (depot.is_achat_olives && depot.prix_achat_unitaire !== null) {
    ticket.montantTotal = depot.prix_achat_unitaire * depot.poids_olives_kg;
  }

  return ticket;
}

export interface TicketPrinter {
  print(ticket: TicketData): Promise<void>;
}

export const browserPrinter: TicketPrinter = {
  async print() {
    window.print();
  },
};
