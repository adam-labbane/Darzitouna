// src/tests/factureSchema.test.ts
import { describe, expect, it } from "vitest";
import { factureSchema } from "../lib/factureSchema";

describe("factureSchema", () => {
  it("accepte un pressage_id valide", () => {
    expect(factureSchema.safeParse({ pressage_id: "pressage-1" }).success).toBe(true);
  });

  it("rejette un pressage_id vide", () => {
    expect(factureSchema.safeParse({ pressage_id: "" }).success).toBe(false);
  });

  it("rejette un pressage_id manquant", () => {
    expect(factureSchema.safeParse({}).success).toBe(false);
  });
});
