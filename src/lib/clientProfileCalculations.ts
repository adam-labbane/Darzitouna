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
