import { describe, expect, it } from "vitest";
import { depotSchema } from "../lib/depotSchema";

const basePrestation = {
  client_id: "client-1",
  poids_brut_kg: 100,
  poids_tare_kg: 15,
  is_achat_olives: false,
};

describe("depotSchema — pesée", () => {
  it("accepte une pesée valide en prestation", () => {
    expect(depotSchema.safeParse(basePrestation).success).toBe(true);
  });

  it("rejette un poids brut négatif ou nul", () => {
    expect(
      depotSchema.safeParse({ ...basePrestation, poids_brut_kg: 0 }).success,
    ).toBe(false);
  });

  it("rejette une tare négative", () => {
    expect(
      depotSchema.safeParse({ ...basePrestation, poids_tare_kg: -5 }).success,
    ).toBe(false);
  });

  it("rejette une tare supérieure ou égale au poids brut (poids net négatif ou nul)", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      poids_brut_kg: 50,
      poids_tare_kg: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejette sans client sélectionné", () => {
    expect(depotSchema.safeParse({ ...basePrestation, client_id: "" }).success).toBe(false);
  });
});

describe("depotSchema — achat", () => {
  it("rejette un achat sans prix", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      montant_paye_achat: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejette un achat sans montant payé renseigné", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
    });
    expect(result.success).toBe(false);
  });

  it("accepte un achat non payé (montant_paye_achat = 0, dette différée)", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepte un achat payé partiellement", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 30,
    });
    expect(result.success).toBe(true);
  });

  it("accepte un achat payé intégralement", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 68,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un montant payé supérieur au montant total", () => {
    const result = depotSchema.safeParse({
      ...basePrestation,
      is_achat_olives: true,
      prix_achat_unitaire: 0.8,
      montant_paye_achat: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("n'exige ni prix ni montant payé en mode prestation", () => {
    expect(depotSchema.safeParse(basePrestation).success).toBe(true);
  });
});
