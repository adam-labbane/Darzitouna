import { describe, expect, it } from "vitest";
import {
  formatMontantDT,
  getPressageStatusClasses,
  getPressageStatusLabel,
  isValidTokenParam,
} from "../lib/ticketPublicDisplay";

describe("isValidTokenParam", () => {
  it("accepte une chaîne non vide", () => {
    expect(isValidTokenParam("abc123")).toBe(true);
  });

  it("rejette undefined", () => {
    expect(isValidTokenParam(undefined)).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidTokenParam("")).toBe(false);
  });

  it("rejette une chaîne composée uniquement d'espaces", () => {
    expect(isValidTokenParam("   ")).toBe(false);
  });
});

describe("getPressageStatusLabel", () => {
  it("libellé pour un dépôt non pressé", () => {
    expect(getPressageStatusLabel(false)).toBe("En attente de pressage");
  });

  it("libellé pour un dépôt pressé", () => {
    expect(getPressageStatusLabel(true)).toBe("Pressage terminé");
  });
});

describe("getPressageStatusClasses", () => {
  it("classes distinctes pour les deux états", () => {
    expect(getPressageStatusClasses(false)).not.toBe(getPressageStatusClasses(true));
  });
});

describe("formatMontantDT", () => {
  it("formate avec 2 décimales et le suffixe DT", () => {
    expect(formatMontantDT(12.5)).toBe("12.50 DT");
  });

  it("formate zéro correctement", () => {
    expect(formatMontantDT(0)).toBe("0.00 DT");
  });

  it("arrondit à 2 décimales", () => {
    expect(formatMontantDT(9.999)).toBe("10.00 DT");
  });
});
