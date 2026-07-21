// src/tests/pressageSchema.test.ts
import { describe, expect, it } from "vitest";
import { pressageSchema } from "../lib/pressageSchema";

function validPayload(overrides: Partial<Parameters<typeof pressageSchema.parse>[0]> = {}) {
  return {
    depot_id: "depot-1",
    cuve_id: "cuve-1",
    quantite_huile_kg: 18,
    type_huile: "VIERGE" as const,
    poids_olives_kg: 100,
    cuve_place_restante_l: 500,
    ...overrides,
  };
}

describe("pressageSchema", () => {
  it("accepte une saisie valide", () => {
    const result = pressageSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejette une quantité d'huile négative ou nulle", () => {
    const result = pressageSchema.safeParse(validPayload({ quantite_huile_kg: 0 }));
    expect(result.success).toBe(false);
  });

  it("rejette un dépôt non sélectionné", () => {
    const result = pressageSchema.safeParse(validPayload({ depot_id: "" }));
    expect(result.success).toBe(false);
  });

  it("rejette une cuve non sélectionnée", () => {
    const result = pressageSchema.safeParse(validPayload({ cuve_id: "" }));
    expect(result.success).toBe(false);
  });

  it("rejette une quantité d'huile incohérente (supérieure au poids d'olives)", () => {
    const result = pressageSchema.safeParse(
      validPayload({ quantite_huile_kg: 150, poids_olives_kg: 100 }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["quantite_huile_kg"]);
    }
  });

  it("rejette un dépassement de la place restante dans la cuve", () => {
    const result = pressageSchema.safeParse(
      validPayload({ quantite_huile_kg: 18, cuve_place_restante_l: 10 }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["cuve_id"]);
    }
  });

  it("accepte une quantité d'huile égale à la place restante exacte", () => {
    const result = pressageSchema.safeParse(
      validPayload({ quantite_huile_kg: 18, cuve_place_restante_l: 18 }),
    );
    expect(result.success).toBe(true);
  });
});
