export type RendementColor = "green" | "orange" | "red";

export const RENDEMENT_COLOR_HEX: Record<RendementColor, string> = {
  green: "#2D6A4F",
  orange: "#F59E0B",
  red: "#E63946",
};

export const RENDEMENT_COLOR_LABELS: Record<RendementColor, string> = {
  green: "Bon rendement",
  orange: "Rendement moyen",
  red: "Rendement faible",
};

export function computeRendement(huileKg: number, olivesKg: number): number {
  if (olivesKg <= 0) return 0;
  return Math.round((huileKg / olivesKg) * 100 * 100) / 100;
}

export function getRendementColor(rendement: number): RendementColor {
  if (rendement > 18) return "green";
  if (rendement >= 15) return "orange";
  return "red";
}

export function computeMontantService(
  poidsOlivesKg: number,
  prixKiloService: number,
  isAchatOlives: boolean,
): number {
  if (isAchatOlives) return 0;
  return Math.round(poidsOlivesKg * prixKiloService * 100) / 100;
}
