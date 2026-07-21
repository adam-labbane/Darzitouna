// src/tests/pressageCalculations.test.ts
import { describe, expect, it } from "vitest";
import {
  computeMontantService,
  computeRendement,
  getRendementColor,
} from "../lib/pressageCalculations";

describe("computeRendement", () => {
  it("calcule le rendement normal", () => {
    expect(computeRendement(18, 100)).toBe(18);
  });

  it("arrondit à 2 décimales", () => {
    expect(computeRendement(17, 105)).toBeCloseTo(16.19, 2);
  });

  it("renvoie 0 si le poids d'olives est nul (évite une division par 0)", () => {
    expect(computeRendement(10, 0)).toBe(0);
  });

  it("renvoie 0 si le poids d'olives est négatif (défensif)", () => {
    expect(computeRendement(10, -5)).toBe(0);
  });
});

describe("getRendementColor", () => {
  it("rouge en dessous de 15 % (14 %)", () => {
    expect(getRendementColor(14)).toBe("red");
  });

  it("orange à la borne 15 %", () => {
    expect(getRendementColor(15)).toBe("orange");
  });

  it("orange à 16 %", () => {
    expect(getRendementColor(16)).toBe("orange");
  });

  it("orange à la borne 18 %", () => {
    expect(getRendementColor(18)).toBe("orange");
  });

  it("vert au-dessus de 18 % (20 %)", () => {
    expect(getRendementColor(20)).toBe("green");
  });

  it("vert juste au-dessus de la borne (18.01 %)", () => {
    expect(getRendementColor(18.01)).toBe("green");
  });

  it("rouge à 0 %", () => {
    expect(getRendementColor(0)).toBe("red");
  });
});

describe("computeMontantService", () => {
  it("calcule poids olives × prix au kilo pour une prestation", () => {
    expect(computeMontantService(100, 0.25, false)).toBe(25);
  });

  it("renvoie 0 pour un dépôt achat, quel que soit le prix", () => {
    expect(computeMontantService(100, 0.25, true)).toBe(0);
  });

  it("arrondit à 2 décimales", () => {
    expect(computeMontantService(33, 0.1, false)).toBeCloseTo(3.3, 2);
  });
});
