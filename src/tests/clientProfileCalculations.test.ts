// src/tests/clientProfileCalculations.test.ts
import { describe, expect, it } from "vitest";
import { computeClientTotals } from "../lib/clientProfileCalculations";

describe("computeClientTotals", () => {
  it("additionne les kilos et compte les dépôts", () => {
    const totals = computeClientTotals(
      [{ poids_olives_kg: 100 }, { poids_olives_kg: 50 }],
      [],
      [],
      0,
    );
    expect(totals.totalKilos).toBe(150);
    expect(totals.nombreDepots).toBe(2);
  });

  it("additionne le facturé et le payé", () => {
    const totals = computeClientTotals(
      [],
      [{ montant_ttc: 25 }, { montant_ttc: 40 }],
      [{ montant: 25 }, { montant: 10 }],
      0,
    );
    expect(totals.totalFacture).toBe(65);
    expect(totals.totalPaye).toBe(35);
  });

  it("calcule le reste dû = facturé - payé", () => {
    const totals = computeClientTotals([], [{ montant_ttc: 65 }], [{ montant: 35 }], 0);
    expect(totals.resteDu).toBe(30);
  });

  it("ajoute le solde initial au reste dû", () => {
    const totals = computeClientTotals([], [{ montant_ttc: 65 }], [{ montant: 35 }], 20);
    expect(totals.resteDu).toBe(50);
  });

  it("plafonne le reste dû à 0 (jamais négatif, même avec un solde initial négatif/crédit)", () => {
    const totals = computeClientTotals([], [{ montant_ttc: 25 }], [{ montant: 25 }], -50);
    expect(totals.resteDu).toBe(0);
  });

  it("plafonne le reste dû à 0 en cas de trop-perçu sans solde initial", () => {
    const totals = computeClientTotals([], [{ montant_ttc: 25 }], [{ montant: 30 }], 0);
    expect(totals.resteDu).toBe(0);
  });

  it("cas vide : client sans aucune activité -> tous les totaux à 0", () => {
    const totals = computeClientTotals([], [], [], 0);
    expect(totals).toEqual({
      totalKilos: 0,
      nombreDepots: 0,
      totalFacture: 0,
      totalPaye: 0,
      resteDu: 0,
    });
  });

  it("client sans activité mais avec un solde initial positif -> reste dû = solde initial", () => {
    const totals = computeClientTotals([], [], [], 15);
    expect(totals.resteDu).toBe(15);
  });
});
