// src/lib/depotWizard.ts
//
// Décision du bouton retour du wizard de dépôt (src/pages/DepotNouveau.tsx).
// Extraite en fonction pure pour être testée sans monter de composant —
// voir le bug corrigé où un clic sur "Quitter" après un aller-retour
// d'étape ne réagissait plus (cause réelle : décalage de mise en page,
// pas cette logique — mais elle reste le point à protéger contre une
// régression future de la branche de décision elle-même).
export type BackAction = "previous-step" | "confirm-exit" | "exit";

/**
 * - step > 1 : revient toujours à l'étape précédente, qu'il y ait des
 *   données saisies ou non (rien n'est perdu, on reste dans le formulaire).
 * - step === 1 avec des données déjà saisies : demande confirmation avant
 *   de quitter (ConfirmDialog), pour éviter une perte accidentelle.
 * - step === 1 sans données : sort directement, rien à perdre.
 */
export function resolveBackAction(step: number, hasUnsavedData: boolean): BackAction {
  if (step > 1) return "previous-step";
  return hasUnsavedData ? "confirm-exit" : "exit";
}
