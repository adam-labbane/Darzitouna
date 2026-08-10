import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * Smoke test de démarrage : monte la VRAIE application dans un DOM.
 *
 * Il couvre l'angle mort qui a laissé passer trois incidents : `tsc -b`,
 * ESLint et les tests de logique métier réussissent tous sans jamais monter
 * un composant. Un désalignement react / react-dom (erreur React #527), une
 * page qui lève à l'import ou un routeur mal câblé produisent un build vert
 * et un écran blanc en production.
 *
 * `render` passe par `createRoot` de react-dom : c'est exactement le chemin
 * qui déclenchait l'erreur #527.
 */

/**
 * App.tsx appelle `createBrowserRouter` au chargement du module : le routeur
 * fige l'URL courante à cet instant. Modifier l'historique après coup n'aurait
 * aucun effet, d'où la réimportation du module après positionnement de l'URL.
 */
async function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  vi.resetModules();
  const { default: App } = await import("../../App");
  return render(<App />);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("démarrage de l'application", () => {
  it("monte et affiche un écran, sans page blanche", async () => {
    await renderAppAt("/");

    // Sans huilerie activée, AppGuard redirige vers l'écran d'activation :
    // le rendu traverse donc le routeur, un garde et une page réelle.
    expect(await screen.findByText(/Code d'activation/i)).toBeDefined();
  });

  it("affiche l'écran de repli français sur une URL inconnue", async () => {
    await renderAppAt("/url-qui-nexiste-pas");

    // Vérifie le câblage réel de l'errorElement dans App.tsx, et non la seule
    // existence du composant : sans lui, React Router afficherait sa page
    // technique en anglais « Unexpected Application Error! ».
    expect(await screen.findByText(/Une erreur est survenue/i)).toBeDefined();
  });
});
