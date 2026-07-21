// src/lib/factureCalculations.ts
//
// Calculs métier de la facturation (montant total, reste dû, affichage du
// statut). Fonctions pures — aucune dépendance à React/Zod/Supabase —
// testées isolément (C2.2.2).
import type { StatutPaiement } from "../types/depot";

// Couleurs partagées avec la palette déjà utilisée ailleurs (STATUT_COLORS
// de DepotsList.tsx, FILL_COLOR_HEX de cuveDisplay.ts) : vert PAYE, orange
// #F59E0B PARTIEL, rouge NON_PAYE.
export const STATUT_LABELS: Record<StatutPaiement, string> = {
  NON_PAYE: "Non payé",
  PARTIEL: "Partiel",
  PAYE: "Payé",
};

export const STATUT_COLOR_HEX: Record<StatutPaiement, string> = {
  NON_PAYE: "#E63946",
  PARTIEL: "#F59E0B",
  PAYE: "#2D6A4F",
};

/**
 * Montant total d'une facture = somme des montants de service des
 * pressages sélectionnés. En V1 (une facture = un pressage, voir le plan
 * de correction/décisions du module), le tableau ne contient qu'un seul
 * élément, mais la fonction reste générale : elle n'a pas besoin de
 * changer si un regroupement de plusieurs pressages est ajouté plus tard.
 */
export function computeMontantTotal(montantsPressages: number[]): number {
  const total = montantsPressages.reduce((sum, m) => sum + m, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Reste dû = montant total − somme des règlements déjà enregistrés,
 * jamais négatif (un total de règlements ne peut normalement pas
 * dépasser le montant grâce au trigger enforce_reglement_not_exceeding_solde,
 * mais l'affichage reste défensif si jamais un écart d'arrondi survenait).
 */
export function computeResteDu(montantTotal: number, reglements: { montant: number }[]): number {
  const dejaRegle = reglements.reduce((sum, r) => sum + r.montant, 0);
  const reste = Math.round((montantTotal - dejaRegle) * 100) / 100;
  return Math.max(0, reste);
}

export function getStatutLabel(statut: StatutPaiement): string {
  return STATUT_LABELS[statut];
}

export function getStatutColor(statut: StatutPaiement): string {
  return STATUT_COLOR_HEX[statut];
}
