// src/tests/reglementSchema.test.ts
import { describe, expect, it } from "vitest";
import { reglementSchema } from "../lib/reglementSchema";

function validPayload(overrides: Partial<Parameters<typeof reglementSchema.parse>[0]> = {}) {
  return {
    montant: 10,
    mode: "ESPECES" as const,
    note: undefined,
    reste_du: 25,
    ...overrides,
  };
}

describe("reglementSchema", () => {
  it("accepte un règlement valide", () => {
    expect(reglementSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("rejette un montant nul", () => {
    expect(reglementSchema.safeParse(validPayload({ montant: 0 })).success).toBe(false);
  });

  it("rejette un montant négatif", () => {
    expect(reglementSchema.safeParse(validPayload({ montant: -5 })).success).toBe(false);
  });

  it("rejette un montant supérieur au reste dû", () => {
    const result = reglementSchema.safeParse(validPayload({ montant: 30, reste_du: 25 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["montant"]);
    }
  });

  it("accepte un montant égal au reste dû exact (solde le règlement)", () => {
    expect(reglementSchema.safeParse(validPayload({ montant: 25, reste_du: 25 })).success).toBe(true);
  });

  it("rejette un mode invalide", () => {
    const result = reglementSchema.safeParse(validPayload({ mode: "CHEQUE" as never }));
    expect(result.success).toBe(false);
  });

  it("accepte les trois modes (espèces, virement, huile)", () => {
    expect(reglementSchema.safeParse(validPayload({ mode: "ESPECES" })).success).toBe(true);
    expect(reglementSchema.safeParse(validPayload({ mode: "VIREMENT" })).success).toBe(true);
    expect(reglementSchema.safeParse(validPayload({ mode: "HUILE" })).success).toBe(true);
  });
});
