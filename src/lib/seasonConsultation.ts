import type { Saison } from "../types/saison";

export function isSeasonMismatch(consultedSaison: Saison | null, activeSaison: Saison | null): boolean {
  if (!consultedSaison) return false;
  return activeSaison === null || consultedSaison.id !== activeSaison.id;
}

export function isConsultationReadOnly(
  consultedSaison: Saison | null,
  activeSaison: Saison | null,
  isOnline: boolean,
): boolean {
  return !isOnline || isSeasonMismatch(consultedSaison, activeSaison);
}
