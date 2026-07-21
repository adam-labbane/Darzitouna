import { describe, expect, it } from "vitest";
import {
  computeMontantTotal,
  computeResteDu,
  getStatutColor,
  getStatutLabel,
} from "../lib/factureCalculations";

describe("computeMontantTotal", () => {
  it("renvoie le montant d'un seul pressage (cas V1)", () => {
    expect(computeMontantTotal([25])).toBe(25);
  });

  it("additionne plusieurs montants", () => {
    expect(computeMontantTotal([25, 10.5, 4.5])).toBe(40);
  });

  it("renvoie 0 pour un tableau vide", () => {
    expect(computeMontantTotal([])).toBe(0);
  });

  it("arrondit à 2 décimales", () => {
    expect(computeMontantTotal([10.005, 10.005])).toBeCloseTo(20.01, 2);
  });
});

describe("computeResteDu", () => {
  it("calcule montant total moins règlements", () => {
    expect(computeResteDu(25, [{ montant: 10 }])).toBe(15);
  });

  it("renvoie 0 quand le montant est intégralement réglé", () => {
    expect(computeResteDu(25, [{ montant: 10 }, { montant: 15 }])).toBe(0);
  });

  it("ne descend jamais sous 0 (défensif, écart d'arrondi)", () => {
    expect(computeResteDu(25, [{ montant: 25.01 }])).toBe(0);
  });

  it("renvoie le montant total complet sans règlement", () => {
    expect(computeResteDu(25, [])).toBe(25);
  });
});

describe("getStatutLabel", () => {
  it("libellés français pour chaque statut", () => {
    expect(getStatutLabel("NON_PAYE")).toBe("Non payé");
    expect(getStatutLabel("PARTIEL")).toBe("Partiel");
    expect(getStatutLabel("PAYE")).toBe("Payé");
  });
});

describe("getStatutColor", () => {
  it("rouge pour NON_PAYE, orange pour PARTIEL, vert pour PAYE", () => {
    expect(getStatutColor("NON_PAYE")).toBe("#E63946");
    expect(getStatutColor("PARTIEL")).toBe("#F59E0B");
    expect(getStatutColor("PAYE")).toBe("#2D6A4F");
  });
});
