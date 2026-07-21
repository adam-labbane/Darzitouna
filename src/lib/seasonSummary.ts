export interface SeasonSummaryRawData {
  huilerieNom: string;
  saisonNom: string;
  dateDebut: string | null;
  dateFin: string | null;
  depots: { poids_olives_kg: number; is_achat_olives: boolean }[];
  pressages: { quantite_huile_kg: number | null }[];
  factures: { montant_ttc: number }[];
  reglements: { montant: number }[];
  cuves: { nom_reference: string; niveau_actuel: number; capacite_max: number }[];
}

export interface SeasonSummaryData {
  huilerieNom: string;
  saisonNom: string;
  dateDebut: string | null;
  dateFin: string | null;
  totalOlivesKg: number;
  nombreDepots: number;
  nombrePrestation: number;
  nombreAchat: number;
  totalHuileKg: number;
  rendementMoyenPct: number;
  totalFacture: number;
  totalEncaisse: number;
  totalResteDu: number;
  cuves: { nomReference: string; niveauActuel: number; capaciteMax: number }[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildSeasonSummary(data: SeasonSummaryRawData): SeasonSummaryData {
  const totalOlivesKg = round2(data.depots.reduce((sum, d) => sum + d.poids_olives_kg, 0));
  const totalHuileKg = round2(data.pressages.reduce((sum, p) => sum + (p.quantite_huile_kg ?? 0), 0));
  const totalFacture = round2(data.factures.reduce((sum, f) => sum + f.montant_ttc, 0));
  const totalEncaisse = round2(data.reglements.reduce((sum, r) => sum + r.montant, 0));

  return {
    huilerieNom: data.huilerieNom,
    saisonNom: data.saisonNom,
    dateDebut: data.dateDebut,
    dateFin: data.dateFin,
    totalOlivesKg,
    nombreDepots: data.depots.length,
    nombrePrestation: data.depots.filter((d) => !d.is_achat_olives).length,
    nombreAchat: data.depots.filter((d) => d.is_achat_olives).length,
    totalHuileKg,
    rendementMoyenPct: totalOlivesKg > 0 ? round2((totalHuileKg / totalOlivesKg) * 100) : 0,
    totalFacture,
    totalEncaisse,
    totalResteDu: Math.max(0, round2(totalFacture - totalEncaisse)),
    cuves: data.cuves.map((cuve) => ({
      nomReference: cuve.nom_reference,
      niveauActuel: cuve.niveau_actuel,
      capaciteMax: cuve.capacite_max,
    })),
  };
}
