import { describe, expect, it } from "vitest";
import { cuveSchema } from "../lib/cuveSchema";

const validCuve = {
  nom_reference: "Cuve 1",
  type_huile: "VIERGE" as const,
  capacite_max: 2000,
};

describe("cuveSchema", () => {
  it("accepte une cuve valide", () => {
    expect(cuveSchema.safeParse(validCuve).success).toBe(true);
  });

  it("rejette une référence vide", () => {
    expect(cuveSchema.safeParse({ ...validCuve, nom_reference: "" }).success).toBe(false);
  });

  it("rejette une référence de plus de 50 caractères", () => {
    expect(
      cuveSchema.safeParse({ ...validCuve, nom_reference: "A".repeat(51) }).success,
    ).toBe(false);
  });

  it("rejette une capacité négative", () => {
    expect(cuveSchema.safeParse({ ...validCuve, capacite_max: -100 }).success).toBe(false);
  });

  it("rejette une capacité nulle", () => {
    expect(cuveSchema.safeParse({ ...validCuve, capacite_max: 0 }).success).toBe(false);
  });

  it("rejette un type d'huile invalide", () => {
    expect(
      cuveSchema.safeParse({ ...validCuve, type_huile: "OLIVE_OIL" }).success,
    ).toBe(false);
  });

  it("accepte les 3 types d'huile valides", () => {
    for (const type_huile of ["EXTRA", "VIERGE", "LAMPANTE"]) {
      expect(cuveSchema.safeParse({ ...validCuve, type_huile }).success).toBe(true);
    }
  });

  it("accepte un emplacement absent (optionnel)", () => {
    expect(cuveSchema.safeParse(validCuve).success).toBe(true);
  });
});
