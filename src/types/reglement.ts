// src/types/reglement.ts
//
// Reflète la table `reglement` (supabase/migrations/20260613130448_create_tables.sql
// + 20260721140000_facturation.sql). Un paiement partiel ou total sur une
// facture_service — plusieurs règlements peuvent s'accumuler (paiements
// fractionnés), voir le trigger update_facture_statut.
export type ModeReglement = "ESPECES" | "HUILE" | "VIREMENT";

export interface Reglement {
  id: string;
  facture_id: string;
  date_reglement: string;
  montant: number;
  mode: ModeReglement;
  note: string | null;
}
