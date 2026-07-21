// src/lib/cuveDisplay.ts
//
// Calculs purs pour le canvas de cuves (pourcentage, couleur, formatage).
// Aucune dépendance à React/Supabase — testés isolément (C2.2.2).
import type { TypeHuile } from "../types/cuve";

export type FillColor = "green" | "orange" | "red" | "gray";

// Libellés affichés pour le type d'huile — centralisés ici pour ne pas
// dupliquer ce mapping dans TankGauge, les modals et la liste.
export const TYPE_HUILE_LABELS: Record<TypeHuile, string> = {
  EXTRA: "Huile extra vierge",
  VIERGE: "Huile vierge",
  LAMPANTE: "Huile lampante",
};

// Couleurs partagées par TankGauge.tsx et TankCanvas.tsx (légende), pour
// ne définir la palette qu'à un seul endroit.
export const FILL_COLOR_HEX: Record<FillColor, string> = {
  green: "#2D6A4F",
  orange: "#F59E0B",
  red: "#E63946",
  gray: "#9CA3AF",
};

export const FILL_COLOR_LABELS: Record<FillColor, string> = {
  green: "Bien remplie (> 50 %)",
  orange: "Niveau moyen (20 à 50 %)",
  red: "Niveau faible (< 20 %)",
  gray: "Vide",
};

/**
 * Pourcentage de remplissage, toujours borné à [0, 100] même si
 * niveau_actuel dépassait capacite_max par erreur (défense en
 * profondeur : la contrainte CHECK en base l'empêche déjà, mais
 * l'affichage ne doit jamais dessiner une jauge à 137 %).
 */
export function computeFillPercentage(niveauActuel: number, capaciteMax: number): number {
  if (capaciteMax <= 0) return 0;
  const pct = (niveauActuel / capaciteMax) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Couleur selon le niveau de remplissage. Seuils (bornes exactes) :
 * 0 % = gris, ]0, 20[ = rouge, [20, 50] = orange, ]50, 100] = vert.
 */
export function getFillColor(percentage: number): FillColor {
  if (percentage <= 0) return "gray";
  if (percentage < 20) return "red";
  if (percentage <= 50) return "orange";
  return "green";
}

// Formatage des litres avec séparateur de milliers français (ex: "1 250 L").
export function formatLiters(value: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} L`;
}

// Delta à envoyer comme mvt_stock_huile.quantite_delta pour qu'une
// correction fasse passer le niveau de currentLevel à newLevel.
export function computeCorrectionDelta(currentLevel: number, newLevel: number): number {
  return newLevel - currentLevel;
}

/**
 * Une capacité éditée ne doit jamais descendre sous le niveau
 * actuellement stocké dans la cuve (sinon niveau_actuel > capacite_max,
 * état incohérent). La contrainte CHECK cuve_niveau_within_capacity le
 * refuse de toute façon côté base — cette fonction sert uniquement à
 * donner un message d'erreur clair côté formulaire (CuveFormModal)
 * avant même d'envoyer la requête, plutôt qu'une erreur réseau générique.
 */
export function isCapacityReductionValid(newCapacity: number, currentLevel: number): boolean {
  return newCapacity >= currentLevel;
}
