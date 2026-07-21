import { describe, expect, it } from "vitest";
import { resolveBackAction } from "../lib/depotWizard";

describe("resolveBackAction", () => {
  it("revient à l'étape précédente si step > 1, avec ou sans données saisies", () => {
    expect(resolveBackAction(2, true)).toBe("previous-step");
    expect(resolveBackAction(2, false)).toBe("previous-step");
    expect(resolveBackAction(4, true)).toBe("previous-step");
  });

  it("demande confirmation à l'étape 1 si des données ont déjà été saisies", () => {
    expect(resolveBackAction(1, true)).toBe("confirm-exit");
  });

  it("sort directement à l'étape 1 sans donnée saisie", () => {
    expect(resolveBackAction(1, false)).toBe("exit");
  });

  it("couvre le scénario du bug signalé en recette : sélection d'un client à l'étape 1, " +
    "aller à l'étape 2, puis revenir — le bouton retour doit toujours proposer " +
    "une confirmation de sortie, jamais un no-op", () => {
    expect(resolveBackAction(2, true)).toBe("previous-step");
    expect(resolveBackAction(1, true)).toBe("confirm-exit");
  });
});
