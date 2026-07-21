// src/tests/saisonSchema.test.ts
import { describe, expect, it } from "vitest";
import { saisonSchema } from "../lib/saisonSchema";

function validPayload(overrides: Partial<Parameters<typeof saisonSchema.parse>[0]> = {}) {
  return {
    nom: "2026-2027",
    date_debut: "2026-09-01",
    date_fin: "2027-01-31",
    config_prix_kilo_service: 0.25,
    ...overrides,
  };
}

describe("saisonSchema", () => {
  it("accepte une saisie valide", () => {
    expect(saisonSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("rejette un nom vide", () => {
    expect(saisonSchema.safeParse(validPayload({ nom: "" })).success).toBe(false);
  });

  it("accepte l'absence de dates (optionnelles)", () => {
    const result = saisonSchema.safeParse(validPayload({ date_debut: "", date_fin: "" }));
    expect(result.success).toBe(true);
  });

  it("rejette des dates incohérentes (fin avant début)", () => {
    const result = saisonSchema.safeParse(
      validPayload({ date_debut: "2026-09-01", date_fin: "2026-08-01" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["date_fin"]);
    }
  });

  it("rejette des dates égales (fin = début)", () => {
    const result = saisonSchema.safeParse(
      validPayload({ date_debut: "2026-09-01", date_fin: "2026-09-01" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejette un prix négatif", () => {
    expect(saisonSchema.safeParse(validPayload({ config_prix_kilo_service: -0.1 })).success).toBe(false);
  });

  it("accepte un prix à 0", () => {
    expect(saisonSchema.safeParse(validPayload({ config_prix_kilo_service: 0 })).success).toBe(true);
  });
});
