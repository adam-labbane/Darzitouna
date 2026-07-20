// src/tests/authPassword.test.ts
import { describe, expect, it } from "vitest";
import { deriveAuthPassword, internalEmailFor } from "../lib/authPassword";

describe("internalEmailFor", () => {
  it("génère un email interne dérivé de l'id utilisateur", () => {
    expect(internalEmailFor("user-1")).toBe("user-1@darzitouna.local");
  });
});

describe("deriveAuthPassword", () => {
  it("reproduit exactement la valeur validée côté PostgreSQL (pgcrypto digest)", async () => {
    // Valeur de référence obtenue en calculant, sur le Supabase local :
    // select encode(digest('33333333-...-333333333333' || ':' || '1234', 'sha256'), 'hex');
    // — les deux implémentations doivent produire un hex identique, sinon
    // signInWithPassword échoue systématiquement en production.
    const password = await deriveAuthPassword(
      "33333333-3333-3333-3333-333333333333",
      "1234",
    );
    expect(password).toBe(
      "33b97d16f54d935f2636c91755f64747a13e184ba5939ea8197b1fa0363e3107",
    );
  });

  it("est déterministe", async () => {
    const a = await deriveAuthPassword("user-1", "1234");
    const b = await deriveAuthPassword("user-1", "1234");
    expect(a).toBe(b);
  });

  it("produit un mot de passe différent pour un PIN différent", async () => {
    const a = await deriveAuthPassword("user-1", "1234");
    const b = await deriveAuthPassword("user-1", "5678");
    expect(a).not.toBe(b);
  });

  it("produit un mot de passe différent pour deux utilisateurs partageant le même PIN", async () => {
    // C'est la propriété de sécurité clé : un PIN volé/deviné ne suffit
    // pas sans connaître aussi l'id de l'utilisateur ciblé.
    const a = await deriveAuthPassword("user-1", "1234");
    const b = await deriveAuthPassword("user-2", "1234");
    expect(a).not.toBe(b);
  });

  it("produit toujours un hex de 64 caractères (sha256), largement au-dessus du minimum Supabase Auth", async () => {
    const password = await deriveAuthPassword("user-1", "0000");
    expect(password).toMatch(/^[0-9a-f]{64}$/);
  });
});
