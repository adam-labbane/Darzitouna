// src/tests/depotCalculations.test.ts
import { describe, expect, it } from "vitest";
import {
  computeNetWeight,
  computePaymentStatus,
  computeRemainingDue,
  computeTotalAmount,
} from "../lib/depotCalculations";

describe("computeNetWeight", () => {
  it("soustrait la tare du poids brut", () => {
    expect(computeNetWeight(100, 15)).toBe(85);
  });

  it("gère une tare nulle", () => {
    expect(computeNetWeight(100, 0)).toBe(100);
  });

  it("peut renvoyer une valeur négative (à valider en amont par le schéma Zod)", () => {
    // computeNetWeight elle-même ne rejette rien : c'est le rôle de
    // depotSchema.ts (tare < brut) de refuser ce cas avant l'appel.
    expect(computeNetWeight(10, 20)).toBe(-10);
  });
});

describe("computeTotalAmount", () => {
  it("multiplie le prix unitaire par le poids net", () => {
    expect(computeTotalAmount(0.8, 85)).toBeCloseTo(68);
  });

  it("renvoie 0 si le poids net est nul", () => {
    expect(computeTotalAmount(0.8, 0)).toBe(0);
  });
});

describe("computeRemainingDue", () => {
  it("calcule le reste dû", () => {
    expect(computeRemainingDue(100, 40)).toBe(60);
  });

  it("renvoie 0 si tout est payé", () => {
    expect(computeRemainingDue(100, 100)).toBe(0);
  });
});

describe("computePaymentStatus", () => {
  it("NON_PAYE si rien n'a été payé", () => {
    expect(computePaymentStatus(100, 0)).toBe("NON_PAYE");
  });

  it("PARTIEL si le montant payé est entre 0 et le total", () => {
    expect(computePaymentStatus(100, 40)).toBe("PARTIEL");
  });

  it("PAYE si le montant payé atteint le total", () => {
    expect(computePaymentStatus(100, 100)).toBe("PAYE");
  });

  it("PAYE si le montant payé dépasse le total (trop-perçu)", () => {
    expect(computePaymentStatus(100, 120)).toBe("PAYE");
  });
});
