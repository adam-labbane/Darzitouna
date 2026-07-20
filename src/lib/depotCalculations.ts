// src/lib/depotCalculations.ts
//
// Calculs métier du dépôt (pesée, montants, statut de paiement). Fonctions
// pures — aucune dépendance à React, Zod ou Supabase — réutilisées à la
// fois par depotSchema.ts (validation croisée) et depots.ts (calcul des
// valeurs à insérer). Testées isolément (C2.2.2).
import type { StatutPaiement } from "../types/depot";

// Poids net = poids brut − tare (poids des caisses/sacs vides). C'est ce
// qui est réellement stocké dans depot.poids_olives_kg.
export function computeNetWeight(poidsBrutKg: number, poidsTareKg: number): number {
  return poidsBrutKg - poidsTareKg;
}

// Montant total d'un achat direct = prix au kilo × poids net.
export function computeTotalAmount(prixUnitaire: number, poidsNetKg: number): number {
  return prixUnitaire * poidsNetKg;
}

// Reste dû à l'agriculteur (paiement partiel ou différé).
export function computeRemainingDue(montantTotal: number, montantPaye: number): number {
  return montantTotal - montantPaye;
}

// Statut de paiement dérivé du montant réellement payé — même logique que
// le trigger update_facture_statut (supabase/migrations/20260613134128_triggers_and_rls.sql),
// mais ici côté application : depot.statut_paiement_achat n'a pas
// d'équivalent de trigger DB (pas de table "règlement" pour les achats
// d'olives, le paiement est saisi directement sur le dépôt).
export function computePaymentStatus(montantTotal: number, montantPaye: number): StatutPaiement {
  if (montantPaye <= 0) return "NON_PAYE";
  if (montantPaye >= montantTotal) return "PAYE";
  return "PARTIEL";
}
