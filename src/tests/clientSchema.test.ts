// src/tests/clientSchema.test.ts
import { describe, expect, it } from "vitest";
import { clientSchema } from "../lib/clientSchema";

describe("clientSchema — nom_complet", () => {
  it("rejette un nom vide", () => {
    const result = clientSchema.safeParse({ nom_complet: "" });
    expect(result.success).toBe(false);
  });

  it("rejette un nom d'un seul caractère", () => {
    const result = clientSchema.safeParse({ nom_complet: "A" });
    expect(result.success).toBe(false);
  });

  it("rejette un nom de plus de 100 caractères", () => {
    const result = clientSchema.safeParse({ nom_complet: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepte un nom valide", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah" });
    expect(result.success).toBe(true);
  });

  it("retire les espaces superflus (trim)", () => {
    const result = clientSchema.safeParse({ nom_complet: "  Ali Ben Salah  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nom_complet).toBe("Ali Ben Salah");
    }
  });
});

describe("clientSchema — telephone", () => {
  it("accepte un téléphone absent", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah" });
    expect(result.success).toBe(true);
  });

  it("accepte un téléphone vide", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah", telephone: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telephone).toBeUndefined();
    }
  });

  it("accepte un numéro tunisien à 8 chiffres", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah", telephone: "20123456" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telephone).toBe("20123456");
    }
  });

  it("accepte un numéro tunisien préfixé +216", () => {
    const result = clientSchema.safeParse({
      nom_complet: "Ali Ben Salah",
      telephone: "+21620123456",
    });
    expect(result.success).toBe(true);
  });

  it("nettoie les espaces/tirets avant validation", () => {
    const result = clientSchema.safeParse({
      nom_complet: "Ali Ben Salah",
      telephone: "20-123-456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telephone).toBe("20123456");
    }
  });

  it("rejette un numéro trop court", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah", telephone: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejette un numéro commençant par 0", () => {
    const result = clientSchema.safeParse({ nom_complet: "Ali Ben Salah", telephone: "01234567" });
    expect(result.success).toBe(false);
  });

  it("rejette un numéro non numérique", () => {
    const result = clientSchema.safeParse({
      nom_complet: "Ali Ben Salah",
      telephone: "abcdefgh",
    });
    expect(result.success).toBe(false);
  });
});
