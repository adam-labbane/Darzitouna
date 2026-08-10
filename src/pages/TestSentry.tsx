/**
 * ⚠️ FICHIER TEMPORAIRE — À SUPPRIMER APRÈS VALIDATION DE LA SONDE SENTRY.
 *
 * Déclencheur de test de la chaîne complète : erreur non rattrapée →
 * ErrorBoundary (écran de repli) → envoi à Sentry.
 *
 * Déclenchement : ouvrir https://darzitounas.com/test-sentry
 *
 * Retrait, en deux gestes :
 *   1. supprimer ce fichier ;
 *   2. dans src/App.tsx, retirer l'import `TestSentry` et l'objet de route
 *      `{ path: "/test-sentry", ... }` (tous deux signalés par un commentaire).
 */
// Le type de retour `never` est explicite : sans lui, TypeScript infère
// `void` pour une fonction qui ne fait que lever, ce qui n'est pas un
// composant JSX valide.
export default function TestSentry(): never {
  throw new Error("Test sonde Sentry");
}
