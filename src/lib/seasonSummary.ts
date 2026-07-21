// src/lib/seasonSummary.ts
//
// Agrégation pure des données brutes d'une saison en un bilan affichable
// (SeasonSummaryView.tsx). Même principe de séparation données/rendu que
// buildTicketData()/buildFactureDocument(), mais avec de vraies
// réductions (sommes, comptes, moyenne) plutôt qu'un simple mapping —
// aucune dépendance à React/Supabase, testable avec des tableaux vides.
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

/**
 * Construit le bilan d'une saison à partir de données déjà chargées
 * (une requête par module, filtrée par RLS et par saison_id — voir
 * getSeasonSummaryData() dans seasonClosure.ts). Le rendement moyen est
 * le ratio global huile/olives, pas la moyenne arithmétique des
 * rendements individuels (qui surpondérerait les petits pressages) —
 * 0 si aucune olive reçue, pour ne jamais diviser par zéro.
 */
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
