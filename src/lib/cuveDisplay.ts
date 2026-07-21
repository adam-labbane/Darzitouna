import type { TypeHuile } from "../types/cuve";

export type FillColor = "green" | "orange" | "red" | "gray";

export const TYPE_HUILE_LABELS: Record<TypeHuile, string> = {
  EXTRA: "Huile extra vierge",
  VIERGE: "Huile vierge",
  LAMPANTE: "Huile lampante",
};

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

export function computeFillPercentage(niveauActuel: number, capaciteMax: number): number {
  if (capaciteMax <= 0) return 0;
  const pct = (niveauActuel / capaciteMax) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function getFillColor(percentage: number): FillColor {
  if (percentage <= 0) return "gray";
  if (percentage < 20) return "red";
  if (percentage <= 50) return "orange";
  return "green";
}

export function formatLiters(value: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} L`;
}

export function computeCorrectionDelta(currentLevel: number, newLevel: number): number {
  return newLevel - currentLevel;
}

export function isCapacityReductionValid(newCapacity: number, currentLevel: number): boolean {
  return newCapacity >= currentLevel;
}
