import type { StatutPaiement } from "./depot";
import type { Reglement } from "./reglement";

export interface Facture {
  id: string;
  saison_id: string;
  client_id: string;
  pressage_id: string;
  numero_facture: string;
  url_pdf: string | null;
  montant_ttc: number;
  statut_paiement: StatutPaiement;
  created_at: string;
}

export interface FactureWithClient extends Facture {
  client: { nom_complet: string } | null;
}

export interface FacturePressageDetail {
  id: string;
  quantite_huile_kg: number | null;
  rendement_final: number | null;
  depot: { numero_ticket: string; poids_olives_kg: number; date_depot: string } | null;
}

export interface FactureWithRelations extends FactureWithClient {
  pressage: FacturePressageDetail | null;
  reglement: Reglement[];
}
