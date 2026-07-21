import { describe, expect, it } from "vitest";
import { personnelCreateSchema, personnelSchema, pinSchema } from "../lib/personnelSchema";

describe("personnelSchema (nom/rôle)", () => {
  it("accepte une saisie valide", () => {
    expect(personnelSchema.safeParse({ nom_complet: "Sami Nouveau", role: "OPERATEUR" }).success).toBe(
      true,
    );
  });

  it("rejette un nom vide", () => {
    expect(personnelSchema.safeParse({ nom_complet: "", role: "OPERATEUR" }).success).toBe(false);
  });

  it("rejette un rôle invalide", () => {
    const result = personnelSchema.safeParse({ nom_complet: "Sami", role: "ADMIN" });
    expect(result.success).toBe(false);
  });

  it("accepte les deux rôles valides", () => {
    expect(personnelSchema.safeParse({ nom_complet: "Sami", role: "GERANT" }).success).toBe(true);
    expect(personnelSchema.safeParse({ nom_complet: "Sami", role: "OPERATEUR" }).success).toBe(true);
  });
});

describe("pinSchema", () => {
  it("accepte un PIN à 4 chiffres", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
  });

  it("rejette un PIN trop court", () => {
    expect(pinSchema.safeParse("123").success).toBe(false);
  });

  it("rejette un PIN trop long", () => {
    expect(pinSchema.safeParse("12345").success).toBe(false);
  });

  it("rejette un PIN non numérique", () => {
    expect(pinSchema.safeParse("abcd").success).toBe(false);
  });
});

describe("personnelCreateSchema", () => {
  it("accepte nom + rôle + PIN valides", () => {
    const result = personnelCreateSchema.safeParse({
      nom_complet: "Sami Nouveau",
      role: "OPERATEUR",
      pin: "7777",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un PIN non conforme même si nom/rôle sont valides", () => {
    const result = personnelCreateSchema.safeParse({
      nom_complet: "Sami Nouveau",
      role: "OPERATEUR",
      pin: "77",
    });
    expect(result.success).toBe(false);
  });
});
