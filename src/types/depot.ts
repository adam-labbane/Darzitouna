// src/types/depot.ts
//
// Reflète la table `depot` (supabase/migrations/20260613130448_create_tables.sql
// + 20260720110000_depot_ticket_and_security.sql). Le statut de paiement
// partagé avec facture_service/vente_grignon (enum SQL statut_paiement).
export type StatutPaiement = "NON_PAYE" | "PARTIEL" | "PAYE";

export interface Depot {
  id: string;
  saison_id: string;
  client_id: string;
  user_id: string;
  numero_ticket: string;
  date_depot: string;
  poids_olives_kg: number;
  ref_bac: string | null;
  is_achat_olives: boolean;
  prix_achat_unitaire: number | null;
  statut_paiement_achat: StatutPaiement;
  montant_paye_achat: number;
}

// Dépôt avec le nom du client embarqué (jointure PostgREST via la FK
// depot.client_id -> client.id), utilisé pour l'affichage en liste sans
// requête séparée par ligne.
export interface DepotWithClient extends Depot {
  client: { nom_complet: string } | null;
}
