// src/types/facture.ts
//
// Reflète la table `facture_service` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721140000_facturation.sql). statut_paiement partage l'enum SQL
// statut_paiement avec depot.statut_paiement_achat — voir types/depot.ts.
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

// Facture avec le nom du client embarqué — pour l'affichage en liste
// sans requête séparée par ligne (même technique que DepotWithClient).
export interface FactureWithClient extends Facture {
  client: { nom_complet: string } | null;
}

// Détail du pressage facturé, tel qu'affiché dans l'aperçu (numéro de
// ticket et poids d'olives du dépôt d'origine, embarqués via pressage).
export interface FacturePressageDetail {
  id: string;
  quantite_huile_kg: number | null;
  rendement_final: number | null;
  depot: { numero_ticket: string; poids_olives_kg: number; date_depot: string } | null;
}

// Forme complète utilisée par le détail facture (aperçu + règlements) :
// client, pressage/dépôt d'origine et tous les règlements déjà enregistrés.
export interface FactureWithRelations extends FactureWithClient {
  pressage: FacturePressageDetail | null;
  reglement: Reglement[];
}
