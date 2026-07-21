// src/lib/seasonConsultation.ts
//
// Détermination pure du mode "consultation en lecture seule" — isolée de
// React pour être testable directement (C2.2.2). Utilisée par
// seasonConsultationContext.tsx, qui expose le résultat via
// useSeasonConsultation() à toute page qui a besoin de savoir si elle
// doit masquer ses actions d'écriture.
import type { Saison } from "../types/saison";

/**
 * Lecture seule dès qu'une saison est explicitement consultée ET que ce
 * n'est pas la saison active :
 * - Aucune saison consultée (sélection pas encore résolue) → false, les
 *   pages retombent sur leur état "aucune saison active" habituel.
 * - Saison consultée = saison active → false, mode de travail normal.
 * - Saison consultée ≠ saison active, y compris si `activeSaison` est
 *   `null` (aucune saison active du tout mais une saison précise est
 *   quand même affichée) → true.
 *
 * Ceci ne remplace jamais la protection côté base (triggers
 * enforce_saison_active_for_write, vérifications dans create_pressage/
 * set_facture_derived_fields — migration
 * 20260722100000_readonly_season_enforcement.sql) : masquer les boutons
 * ici est un confort d'ergonomie, la vraie garantie reste en base.
 */
export function isConsultationReadOnly(
  consultedSaison: Saison | null,
  activeSaison: Saison | null,
): boolean {
  if (!consultedSaison) return false;
  return activeSaison === null || consultedSaison.id !== activeSaison.id;
}
