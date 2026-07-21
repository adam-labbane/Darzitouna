// src/lib/clientProfileCalculations.ts
//
// Agrégation pure des totaux d'un client (fiche client + colonne "reste
// dû" de la liste des clients). Même principe que computeResteDu
// (factureCalculations.ts), étendu au client entier — aucune dépendance
// à React/Supabase, testable avec des tableaux vides.
export interface ClientTotals {
  totalKilos: number;
  nombreDepots: number;
  totalFacture: number;
  totalPaye: number;
  resteDu: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Reste dû = factures − règlements + solde initial (solde_compte du
 * MCD, utilisé comme ajustement manuel — ex. dette antérieure à
 * l'app). Calculé à chaque lecture, jamais stocké : la seule source de
 * vérité est la somme réelle des factures et règlements en base, donc
 * aucune désynchronisation possible (contrairement à un champ mis à
 * jour par trigger, qui pourrait dévier si un trigger était un jour
 * oublié sur un nouveau chemin d'écriture).
 *
 * Plafonné à 0 : un solde initial négatif (crédit du client) ou un
 * trop-perçu ne doit jamais afficher un "reste dû" négatif à l'écran.
 */
export function computeClientTotals(
  depots: { poids_olives_kg: number }[],
  factures: { montant_ttc: number }[],
  reglements: { montant: number }[],
  soldeInitial: number,
): ClientTotals {
  const totalKilos = round2(depots.reduce((sum, depot) => sum + depot.poids_olives_kg, 0));
  const totalFacture = round2(factures.reduce((sum, facture) => sum + facture.montant_ttc, 0));
  const totalPaye = round2(reglements.reduce((sum, reglement) => sum + reglement.montant, 0));
  const resteDu = Math.max(0, round2(totalFacture - totalPaye + soldeInitial));

  return {
    totalKilos,
    nombreDepots: depots.length,
    totalFacture,
    totalPaye,
    resteDu,
  };
}
