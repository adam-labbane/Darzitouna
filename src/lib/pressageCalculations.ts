// src/lib/pressageCalculations.ts
//
// Calculs métier du pressage (rendement, montant du service). Fonctions
// pures — aucune dépendance à React/Zod/Supabase — testées isolément
// (C2.2.2). Mêmes formules que côté base (fonction create_pressage,
// migration 20260721130000_pressage_creation.sql) : dupliquées ici
// volontairement pour l'affichage en temps réel dans PressageModal avant
// validation, la base restant la seule source de vérité pour les valeurs
// réellement enregistrées.
export type RendementColor = "green" | "orange" | "red";

// Couleurs partagées avec cuveDisplay.ts (mêmes codes que FILL_COLOR_HEX)
// pour une cohérence visuelle entre les modules Cuves et Pressage.
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

/**
 * Rendement en pourcentage, arrondi à 2 décimales. 0 si le poids
 * d'olives est nul ou négatif (défense en profondeur, évite une
 * division par 0 — la contrainte NOT NULL/positive du dépôt l'empêche
 * déjà en pratique).
 */
export function computeRendement(huileKg: number, olivesKg: number): number {
  if (olivesKg <= 0) return 0;
  return Math.round((huileKg / olivesKg) * 100 * 100) / 100;
}

/**
 * Couleur selon le rendement obtenu. Repères métier (bornes exactes) :
 * < 15 % = rouge, [15, 18] = orange, > 18 % = vert.
 */
export function getRendementColor(rendement: number): RendementColor {
  if (rendement > 18) return "green";
  if (rendement >= 15) return "orange";
  return "red";
}

/**
 * Montant du service de pressage = poids d'olives × prix au kilo de la
 * saison. Un dépôt achat (l'huilerie presse ses propres olives déjà
 * achetées) ne génère aucun montant : elle ne se facture pas elle-même.
 */
export function computeMontantService(
  poidsOlivesKg: number,
  prixKiloService: number,
  isAchatOlives: boolean,
): number {
  if (isAchatOlives) return 0;
  return Math.round(poidsOlivesKg * prixKiloService * 100) / 100;
}
