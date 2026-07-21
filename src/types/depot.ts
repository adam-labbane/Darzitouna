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

export interface DepotWithClient extends Depot {
  client: { nom_complet: string } | null;
}
